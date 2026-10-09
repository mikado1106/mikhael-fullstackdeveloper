import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ApplicationStatus, Prisma, Role } from '@prisma/client';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { CompaniesService } from '../companies/companies.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { assertStatusTransition } from './application-status.rules';
import { ApplicationTimelineResponseDto } from './dto/application-timeline-response.dto';
import { CreateApplicationDto } from './dto/create-application.dto';
import { UpdateApplicationStatusDto } from './dto/update-application-status.dto';

const jobSummarySelect = {
  id: true,
  title: true,
  location: true,
  jobType: true,
  salaryMin: true,
  salaryMax: true,
  companyId: true,
  company: { select: { id: true, name: true } },
} satisfies Prisma.JobSelect;

const applicantSelect = {
  id: true,
  name: true,
  email: true,
} satisfies Prisma.UserSelect;

function isPrismaError(error: unknown, code: string): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

const applicationDetailInclude = {
  job: { select: jobSummarySelect },
  applicant: { select: applicantSelect },
  history: {
    orderBy: { createdAt: Prisma.SortOrder.asc },
    include: { changedBy: { select: { id: true, name: true, role: true } } },
  },
} satisfies Prisma.ApplicationInclude;

@Injectable()
export class ApplicationsService {
  private readonly logger = new Logger(ApplicationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly companiesService: CompaniesService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async apply(jobId: string, user: AuthenticatedUser, dto: CreateApplicationDto) {
    return this.prisma.$transaction(async (tx) => {
      // The row lock prevents deactivation between eligibility and insertion.
      const rows = await tx.$queryRaw<{ id: string; isActive: boolean }[]>`
        SELECT id, "isActive" FROM "jobs" WHERE id = ${jobId} FOR UPDATE`;
      const job = rows[0];
      if (!job) {
        throw new NotFoundException('Job not found');
      }
      if (!job.isActive) {
        throw new BadRequestException('This job is no longer accepting applications');
      }

      try {
        return await tx.application.create({
          data: {
            jobId,
            applicantId: user.id,
            coverLetter: dto.coverLetter,
            status: ApplicationStatus.APPLIED,
            history: {
              create: {
                fromStatus: null,
                toStatus: ApplicationStatus.APPLIED,
                changedById: user.id,
                note: 'Application submitted',
              },
            },
          },
          include: applicationDetailInclude,
        });
      } catch (error) {
        if (isPrismaError(error, 'P2002')) {
          throw new ConflictException('You have already applied to this job');
        }
        throw error;
      }
    });
  }

  async findMine(user: AuthenticatedUser, query: PaginationQueryDto) {
    const { page, limit } = query;
    const where = { applicantId: user.id };

    const [total, data] = await this.prisma.$transaction([
      this.prisma.application.count({ where }),
      this.prisma.application.findMany({
        where,
        include: { job: { select: jobSummarySelect } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      data,
      meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    };
  }

  async findForJob(jobId: string, user: AuthenticatedUser, query: PaginationQueryDto) {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      select: { id: true, title: true, companyId: true },
    });
    if (!job) {
      throw new NotFoundException('Job not found');
    }
    await this.assertOwnsJob(job.companyId, user);

    const { page, limit } = query;
    const where = { jobId };

    const [total, data] = await this.prisma.$transaction([
      this.prisma.application.count({ where }),
      this.prisma.application.findMany({
        where,
        include: { applicant: { select: applicantSelect } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      job: { id: job.id, title: job.title },
      data,
      meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    };
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const application = await this.prisma.application.findUnique({
      where: { id },
      include: applicationDetailInclude,
    });
    if (!application) {
      throw new NotFoundException('Application not found');
    }

    if (user.role === Role.JOB_SEEKER) {
      if (application.applicantId !== user.id) {
        throw new ForbiddenException('You can only view your own applications');
      }
    } else {
      await this.assertOwnsJob(application.job.companyId, user);
    }

    return application;
  }

  async getTimeline(
    id: string,
    user: AuthenticatedUser,
  ): Promise<ApplicationTimelineResponseDto> {
    // RepeatableRead keeps the parent status and nested history in one snapshot.
    return this.prisma.$transaction(
      async (tx) => {
        const application = await tx.application.findUnique({
          where: { id },
          select: {
            id: true,
            applicantId: true,
            status: true,
            job: { select: { companyId: true } },
            history: {
              select: {
                id: true,
                toStatus: true,
                createdAt: true,
              },
              orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
            },
          },
        });

        if (!application) {
          throw new NotFoundException('Application not found');
        }

        if (user.role === Role.JOB_SEEKER) {
          if (application.applicantId !== user.id) {
            throw new ForbiddenException('You can only view your own applications');
          }
        } else {
          await this.assertOwnsJob(application.job.companyId, user);
        }

        // Explicit allowlist: neither internal notes nor actor IDs reach the API.
        return {
          applicationId: application.id,
          currentStatus: application.status,
          history: application.history.map((entry) => ({
            id: entry.id,
            status: entry.toStatus,
            occurredAt: entry.createdAt.toISOString(),
          })),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  async updateStatus(id: string, user: AuthenticatedUser, dto: UpdateApplicationStatusDto) {
    const application = await this.prisma.application.findUnique({
      where: { id },
      select: { id: true, status: true, job: { select: { companyId: true } } },
    });
    if (!application) {
      throw new NotFoundException('Application not found');
    }
    await this.assertOwnsJob(application.job.companyId, user);
    assertStatusTransition(application.status, dto.status);

    const prevStatus = application.status;
    let updated: Prisma.ApplicationGetPayload<{
      include: typeof applicationDetailInclude;
    }>;

    try {
      // Compare-and-set prevents silently overwriting a concurrent status change.
      updated = await this.prisma.application.update({
        where: { id, status: application.status },
        data: {
          status: dto.status,
          history: {
            create: {
              fromStatus: application.status,
              toStatus: dto.status,
              changedById: user.id,
              note: dto.note,
            },
          },
        },
        include: applicationDetailInclude,
      });
    } catch (error) {
      if (isPrismaError(error, 'P2025')) {
        throw new ConflictException(
          'Application status was changed by someone else, please refresh and try again',
        );
      }
      throw error;
    }

    // Await best-effort notification with a bounded timeout.
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        this.notificationsService.sendStatusChangedEmail({
          to: updated.applicant.email,
          applicantName: updated.applicant.name,
          jobTitle: updated.job.title,
          companyName: updated.job.company.name,
          oldStatus: prevStatus,
          newStatus: dto.status,
          note: dto.note,
          applicationId: updated.id,
        }),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => reject(new Error('EmailSendTimeout')), 5000);
        }),
      ]);
    } catch {
      // Provider errors may contain PII; only log a constant message.
      this.logger.error('Status change email failed or timed out');
    } finally {
      if (timeout) {
        clearTimeout(timeout);
      }
    }

    return updated;
  }

  private async assertOwnsJob(jobCompanyId: string, user: AuthenticatedUser): Promise<void> {
    const ownedCompanyId = await this.companiesService.getOwnedCompanyId(user.id);
    if (ownedCompanyId !== jobCompanyId) {
      throw new ForbiddenException('You can only manage applications for your own jobs');
    }
  }
}
