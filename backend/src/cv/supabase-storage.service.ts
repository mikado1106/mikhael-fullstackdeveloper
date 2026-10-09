import {
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const CV_BUCKET = 'seeker-cv';
export const DOWNLOAD_URL_TTL_SECONDS = 60;

// Supabase signed upload URLs have a fixed two-hour lifetime.
export const UPLOAD_URL_TTL_SECONDS = 2 * 60 * 60;

export class StorageObjectMissingError extends Error {
  constructor() {
    super('Storage object does not exist');
    this.name = 'StorageObjectMissingError';
  }
}

export interface ObjectInspection {
  sizeBytes: number;
  mimeType: string;
  prefix: Buffer;
}

@Injectable()
export class SupabaseStorageService {
  private readonly client: SupabaseClient;

  constructor() {
    const url = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceRoleKey) {
      throw new Error(
        'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured',
      );
    }

    this.client = createClient(url, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }

  async createUploadUrl(path: string) {
    const { data, error } = await this.client.storage
      .from(CV_BUCKET)
      .createSignedUploadUrl(path, { upsert: false });

    if (error || !data?.signedUrl) {
      throw this.unavailable();
    }

    return {
      url: data.signedUrl,
      method: 'PUT' as const,
      headers: {
        'Content-Type': 'application/pdf',
        'x-upsert': 'false',
      },
      expiresAt: new Date(
        Date.now() + UPLOAD_URL_TTL_SECONDS * 1000,
      ).toISOString(),
    };
  }

  async createDownloadUrl(
    path: string,
    fileName?: string,
  ): Promise<{ url: string; expiresAt: string }> {
    const { data, error } = await this.client.storage
      .from(CV_BUCKET)
      .createSignedUrl(
        path,
        DOWNLOAD_URL_TTL_SECONDS,
        fileName ? { download: fileName } : undefined,
      );

    if (error || !data?.signedUrl) {
      if (this.isMissing(error)) {
        throw new StorageObjectMissingError();
      }
      throw this.unavailable();
    }

    return {
      url: data.signedUrl,
      expiresAt: new Date(
        Date.now() + DOWNLOAD_URL_TTL_SECONDS * 1000,
      ).toISOString(),
    };
  }

  async inspect(path: string): Promise<ObjectInspection> {
    const { url } = await this.createDownloadUrl(path);

    try {
      const head = await fetch(url, {
        method: 'HEAD',
        cache: 'no-store',
        redirect: 'error',
        signal: AbortSignal.timeout(10_000),
      });

      if (head.status === 404) {
        throw new StorageObjectMissingError();
      }
      if (!head.ok) {
        throw this.unavailable();
      }

      const length = head.headers.get('content-length');
      const sizeBytes = length === null ? Number.NaN : Number(length);
      const mimeType = (
        head.headers.get('content-type') ?? ''
      ).split(';', 1)[0].trim().toLowerCase();

      if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 0) {
        throw this.unavailable();
      }

      const response = await fetch(url, {
        method: 'GET',
        headers: { Range: 'bytes=0-4' },
        cache: 'no-store',
        redirect: 'error',
        signal: AbortSignal.timeout(10_000),
      });

      if (response.status === 404) {
        throw new StorageObjectMissingError();
      }
      if (
        (response.status !== 200 && response.status !== 206) ||
        !response.body
      ) {
        await response.body?.cancel();
        throw this.unavailable();
      }

      // Bound memory even if the storage endpoint ignores Range.
      const reader = response.body.getReader();
      const prefix = Buffer.alloc(5);
      let lengthRead = 0;

      try {
        while (lengthRead < 5) {
          const { done, value } = await reader.read();
          if (done) break;

          const count = Math.min(value.byteLength, 5 - lengthRead);
          prefix.set(value.subarray(0, count), lengthRead);
          lengthRead += count;
        }
      } finally {
        await reader.cancel().catch(() => undefined);
      }

      return {
        sizeBytes,
        mimeType,
        prefix: prefix.subarray(0, lengthRead),
      };
    } catch (error) {
      if (
        error instanceof StorageObjectMissingError ||
        error instanceof ServiceUnavailableException
      ) {
        throw error;
      }

      // Never expose fetch errors: their messages may contain signed URLs.
      throw this.unavailable();
    }
  }

  async ensureCopied(
    sourcePath: string,
    destinationPath: string,
  ): Promise<void> {
    const { error } = await this.client.storage
      .from(CV_BUCKET)
      .copy(sourcePath, destinationPath);

    if (!error) return;

    // A previous copy can survive a database rollback. Destination paths are
    // attempt-specific and writable only by this service.
    if (this.isConflict(error)) {
      return;
    }

    throw this.unavailable();
  }

  async remove(path: string): Promise<void> {
    const { error } = await this.client.storage
      .from(CV_BUCKET)
      .remove([path]);

    if (error && !this.isMissing(error)) {
      throw this.unavailable();
    }
  }

  private isMissing(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;

    const value = error as {
      status?: number | string;
      statusCode?: number | string;
      message?: string;
    };

    return (
      Number(value.statusCode ?? value.status) === 404 ||
      value.message?.toLowerCase() === 'object not found'
    );
  }

  private isConflict(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;

    const value = error as {
      status?: number | string;
      statusCode?: number | string;
      message?: string;
    };

    return (
      Number(value.statusCode ?? value.status) === 409 ||
      value.message?.toLowerCase() === 'the resource already exists'
    );
  }

  private unavailable(): ServiceUnavailableException {
    return new ServiceUnavailableException({
      code: 'STORAGE_UNAVAILABLE',
      message: 'CV storage is temporarily unavailable',
    });
  }
}
