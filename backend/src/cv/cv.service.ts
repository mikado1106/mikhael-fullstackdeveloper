import {
  HttpException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import {
  CV_MAX_SIZE_BYTES,
  CV_MIME_TYPE,
  UploadUrlDto,
} from './dto/upload-url.dto';
import {
  ObjectInspection,
  StorageObjectMissingError,
  SupabaseStorageService,
  UPLOAD_URL_TTL_SECONDS,
} from './supabase-storage.service';

/*
 * Actual schema (prisma/schema.prisma):
 * CvDocument: id, userId @unique, latestIssued BigInt, activeGeneration BigInt,
 *   activeObjectPath String? @unique, activeFileName?, activeSizeBytes?,
 *   activeMimeType?, activatedAt?
 * CvUploadAttempt: id, documentId FK, generation BigInt, status CvUploadStatus,
 *   temporaryObjectPath @unique, finalObjectPath @unique, fileName,
 *   declaredSizeBytes Int, declaredMimeType, expiresAt, uploadCapabilityUntil,
 *   leaseToken?, leaseUntil?, finalizedAt?, failureCode?
 * CvUploadStatus: PENDING | VERIFYING | FINALIZED | FAILED | EXPIRED | SUPERSEDED
 * StorageCleanupTask: id, objectPath @unique, reason, unneededAt, notBefore,
 *   nextRunAt, attempts, leaseToken?, leaseUntil?, completedAt?, lastErrorCode?
 */

const ATTEMPT_TTL_MS = 30 * 60 * 1000;
const RATE_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT = 10;
const PENDING_LIMIT = 3;
const FINALIZE_LEASE_MS = 2 * 60 * 1000;

// Keep objects beyond every outstanding upload/download URL's lifetime.
const CLEANUP_GRACE_MS = UPLOAD_URL_TTL_SECONDS * 1000 + 15 * 60 * 1000;

export interface PublicCv {
  id: string;
  fileName: string;
  sizeBytes: number;
  mimeType: string;
  updatedAt: string;
}

export interface FinalizeResponse {
  attemptId: string;
  status: 'FINALIZED';
  isActive: boolean;
  cv: PublicCv;
}

@Injectable()
export class CvService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: SupabaseStorageService,
  ) {}

  /** Get or create the CvDocument row for a user (row-lock anchor). */
  private async getOrCreateDocument(
    tx: Prisma.TransactionClient,
    userId: string,
  ) {
    let doc = await tx.cvDocument.findUnique({ where: { userId } });
    if (!doc) {
      doc = await tx.cvDocument.create({ data: { userId } });
    }
    return doc;
  }

  async issueUploadUrl(userId: string, dto: UploadUrlDto) {
    const attempt = await this.prisma.$transaction(async (tx) => {
      const doc = await this.getOrCreateDocument(tx, userId);
      const now = new Date();

      const recentCount = await tx.cvUploadAttempt.count({
        where: {
          documentId: doc.id,
          createdAt: { gte: new Date(now.getTime() - RATE_WINDOW_MS) },
        },
      });
      if (recentCount >= RATE_LIMIT) {
        throw this.apiError(429, 'RATE_LIMITED', 'Too many upload requests; try again later');
      }

      const pendingCount = await tx.cvUploadAttempt.count({
        where: {
          documentId: doc.id,
          status: { in: ['PENDING', 'VERIFYING'] },
          expiresAt: { gt: now },
        },
      });
      if (pendingCount >= PENDING_LIMIT) {
        throw this.apiError(429, 'UPLOAD_PENDING_LIMIT', 'Too many pending CV uploads');
      }

      const generation = doc.latestIssued + BigInt(1);
      const id = randomUUID();
      const expiresAt = new Date(now.getTime() + ATTEMPT_TTL_MS);
      const uploadCapabilityUntil = new Date(now.getTime() + UPLOAD_URL_TTL_SECONDS * 1000);
      const temporaryObjectPath = `tmp/${userId}/${id}.pdf`;
      const finalObjectPath = `documents/${userId}/${id}.pdf`;

      await tx.cvDocument.update({
        where: { id: doc.id },
        data: { latestIssued: generation },
      });

      const created = await tx.cvUploadAttempt.create({
        data: {
          id,
          documentId: doc.id,
          generation,
          status: 'PENDING',
          temporaryObjectPath,
          finalObjectPath,
          fileName: dto.fileName,
          declaredSizeBytes: dto.sizeBytes,
          declaredMimeType: dto.mimeType,
          expiresAt,
          uploadCapabilityUntil,
        },
      });

      const notBefore = new Date(uploadCapabilityUntil.getTime() + 15 * 60 * 1000);
      await this.scheduleCleanup(tx, temporaryObjectPath, 'attempt-tmp', notBefore);
      await this.scheduleCleanup(tx, finalObjectPath, 'attempt-final', notBefore);

      return created;
    });

    const upload = await this.storage.createUploadUrl(attempt.temporaryObjectPath);

    return {
      attemptId: attempt.id,
      attemptExpiresAt: attempt.expiresAt.toISOString(),
      upload,
      constraints: {
        minBytes: 1,
        maxBytes: CV_MAX_SIZE_BYTES,
        mimeType: CV_MIME_TYPE,
      },
    };
  }

  async finalize(userId: string, attemptId: string): Promise<FinalizeResponse> {
    const doc = await this.prisma.cvDocument.findUnique({ where: { userId } });
    if (!doc) throw this.notFound('UPLOAD_ATTEMPT_NOT_FOUND');

    const attemptMeta = await this.prisma.cvUploadAttempt.findFirst({
      where: { id: attemptId, documentId: doc.id },
      select: { id: true },
    });
    if (!attemptMeta) throw this.notFound('UPLOAD_ATTEMPT_NOT_FOUND');

    const leaseToken = randomUUID();
    const now = new Date();

    // Phase 1: acquire lease + validate state (short tx, real row lock).
    const phase1 = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "cv_documents" WHERE "id" = ${doc.id} FOR UPDATE`;

      const attempt = await tx.cvUploadAttempt.findFirst({
        where: { id: attemptId, documentId: doc.id },
      });
      if (!attempt) throw this.notFound('UPLOAD_ATTEMPT_NOT_FOUND');

      const locked = await tx.cvDocument.findUnique({ where: { id: doc.id } });
      const activeGen = locked?.activeGeneration ?? BigInt(0);

      if (attempt.status === 'FINALIZED') {
        return { already: true as const, isActive: locked?.activeGeneration === attempt.generation, attempt };
      }
      if (attempt.status === 'SUPERSEDED' || attempt.generation <= activeGen) {
        return { terminal: 'SUPERSEDED' as const, attempt };
      }
      if (attempt.status === 'EXPIRED' || attempt.expiresAt.getTime() <= now.getTime()) {
        return { terminal: 'EXPIRED' as const, attempt };
      }
      if (attempt.status === 'FAILED') {
        return { terminal: 'FAILED' as const, attempt };
      }
      if (attempt.leaseUntil && attempt.leaseUntil.getTime() > now.getTime()) {
        throw this.apiError(409, 'FINALIZATION_IN_PROGRESS', 'CV finalization is already in progress');
      }

      await tx.cvUploadAttempt.update({
        where: { id: attempt.id },
        data: { status: 'VERIFYING', leaseToken, leaseUntil: new Date(now.getTime() + FINALIZE_LEASE_MS) },
      });
      return { already: false as const, attempt };
    });

    if (phase1.already) {
      const current = await this.prisma.cvDocument.findUnique({ where: { id: doc.id } });
      return {
        attemptId: phase1.attempt.id, status: 'FINALIZED',
        isActive: phase1.isActive ?? false,
        cv: this.publicCvFromDocument(current!),
      };
    }
    if ('terminal' in phase1 && phase1.terminal) {
      // Commit terminal status OUTSIDE the tx so it is not rolled back.
      await this.prisma.cvUploadAttempt.update({
        where: { id: phase1.attempt.id },
        data: { status: phase1.terminal },
      });
      const map = {
        SUPERSEDED: [409, 'UPLOAD_SUPERSEDED', 'A newer CV is already active'],
        EXPIRED: [410, 'UPLOAD_ATTEMPT_EXPIRED', 'The upload attempt has expired'],
        FAILED: [422, 'CV_VALIDATION_FAILED', 'The uploaded file is not a valid PDF'],
      } as const;
      const [status, code, message] = map[phase1.terminal];
      throw this.apiError(status, code, message);
    }

    const attempt = (phase1 as { attempt: any }).attempt;

    // Phase 2: storage ops OUTSIDE any DB transaction.
    let inspection: ObjectInspection;
    try {
      inspection = await this.storage.inspect(attempt.temporaryObjectPath);
    } catch (error) {
      if (error instanceof StorageObjectMissingError) {
        await this.prisma.cvUploadAttempt.update({
          where: { id: attempt.id },
          data: { status: 'PENDING', leaseToken: null, leaseUntil: null },
        });
        throw this.apiError(409, 'UPLOAD_NOT_READY', 'Upload the file before finalizing');
      }
      throw error;
    }

    if (!this.validObject(inspection, attempt.declaredSizeBytes)) {
      await this.prisma.cvUploadAttempt.update({
        where: { id: attempt.id },
        data: { status: 'FAILED', failureCode: 'VALIDATION', leaseToken: null, leaseUntil: null },
      });
      throw this.apiError(422, 'CV_VALIDATION_FAILED', 'The uploaded file does not satisfy PDF constraints');
    }

    await this.storage.ensureCopied(attempt.temporaryObjectPath, attempt.finalObjectPath);
    const finalInspection = await this.storage.inspect(attempt.finalObjectPath);
    if (!this.validObject(finalInspection, attempt.declaredSizeBytes)) {
      await this.prisma.cvUploadAttempt.update({
        where: { id: attempt.id },
        data: { status: 'FAILED', failureCode: 'VALIDATION', leaseToken: null, leaseUntil: null },
      });
      throw this.apiError(422, 'CV_VALIDATION_FAILED', 'The stored file does not satisfy PDF constraints');
    }

    // Phase 3: activation (short tx, conditional on generation).
    const phase3 = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "cv_documents" WHERE "id" = ${doc.id} FOR UPDATE`;

      const freshAttempt = await tx.cvUploadAttempt.findFirst({
        where: { id: attempt.id, leaseToken },
      });
      if (!freshAttempt) throw this.apiError(409, 'FINALIZATION_IN_PROGRESS', 'Lease lost');

      const updated = await tx.cvDocument.updateMany({
        where: { id: doc.id, activeGeneration: { lt: attempt.generation } },
        data: {
          activeGeneration: attempt.generation,
          activeObjectPath: attempt.finalObjectPath,
          activeFileName: attempt.fileName,
          activeSizeBytes: finalInspection.sizeBytes,
          activeMimeType: CV_MIME_TYPE,
          activatedAt: new Date(),
        },
      });
      if (updated.count === 0) {
        return { superseded: true as const };
      }

      await tx.cvUploadAttempt.update({
        where: { id: attempt.id },
        data: { status: 'FINALIZED', finalizedAt: new Date(), leaseToken: null, leaseUntil: null },
      });

      // P0 fix: cancel cleanup for the path that just became active.
      await tx.storageCleanupTask.updateMany({
        where: { objectPath: attempt.finalObjectPath, completedAt: null },
        data: { completedAt: new Date(), lastErrorCode: 'BECAME_ACTIVE' },
      });

      return { superseded: false as const };
    });

    if (phase3.superseded) {
      await this.prisma.cvUploadAttempt.update({
        where: { id: attempt.id },
        data: { status: 'SUPERSEDED', leaseToken: null, leaseUntil: null },
      });
      throw this.apiError(409, 'UPLOAD_SUPERSEDED', 'A newer CV is already active');
    }

    const current = await this.prisma.cvDocument.findUnique({ where: { id: doc.id } });
    return {
      attemptId: attempt.id, status: 'FINALIZED', isActive: true,
      cv: this.publicCvFromDocument(current!),
    };
  }

  async getCv(userId: string): Promise<{ cv: PublicCv | null }> {
    const doc = await this.prisma.cvDocument.findUnique({ where: { userId } });
    if (!doc || !doc.activeObjectPath) return { cv: null };
    return { cv: this.publicCvFromDocument(doc) };
  }

  async getDownloadUrl(userId: string) {
    const doc = await this.prisma.cvDocument.findUnique({ where: { userId } });
    if (!doc || !doc.activeObjectPath) {
      throw new NotFoundException({ code: 'CV_NOT_AVAILABLE', message: 'No active CV' });
    }
    const signed = await this.storage.createDownloadUrl(doc.activeObjectPath, doc.activeFileName ?? 'cv.pdf');
    return { ...signed, fileName: doc.activeFileName };
  }

  async getApplicationCvUrl(companyUserId: string, applicationId: string) {
    const application = await this.prisma.application.findFirst({
      where: {
        id: applicationId,
        job: { company: { userId: companyUserId } },
      },
      select: { applicantId: true },
    });
    // Identical response for absent and unauthorized applications.
    if (!application) {
      throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Application not found' });
    }
    // Intentionally the applicant's current active CV, not a snapshot.
    return this.getDownloadUrl(application.applicantId);
  }

  private validObject(object: ObjectInspection, expectedSize: number): boolean {
    const prefix = object.prefix.subarray(0, 5);
    return (
      Number.isSafeInteger(object.sizeBytes) &&
      object.sizeBytes >= 1 &&
      object.sizeBytes <= CV_MAX_SIZE_BYTES &&
      object.sizeBytes === expectedSize &&
      object.mimeType === CV_MIME_TYPE &&
      prefix.equals(Buffer.from('%PDF-', 'ascii'))
    );
  }

  private publicCvFromDocument(doc: {
    id: string;
    activeFileName: string | null;
    activeSizeBytes: number | null;
    activeMimeType: string | null;
    activatedAt: Date | null;
  }): PublicCv {
    return {
      id: doc.id,
      fileName: doc.activeFileName ?? '',
      sizeBytes: doc.activeSizeBytes ?? 0,
      mimeType: doc.activeMimeType ?? CV_MIME_TYPE,
      updatedAt: (doc.activatedAt ?? new Date()).toISOString(),
    };
  }

  private apiError(status: number, code: string, message: string) {
    return new HttpException({ code, message }, status);
  }

  private notFound(code: string) {
    return new NotFoundException({ code, message: 'Requested resource was not found' });
  }

  private async scheduleCleanup(
    tx: Prisma.TransactionClient,
    objectPath: string,
    reason: string,
    notBefore: Date,
  ): Promise<void> {
    const unneededAt = new Date();
    await tx.storageCleanupTask.upsert({
      where: { objectPath },
      create: { objectPath, reason, unneededAt, notBefore, nextRunAt: notBefore },
      update: { notBefore, nextRunAt: notBefore },
    });
  }
}
