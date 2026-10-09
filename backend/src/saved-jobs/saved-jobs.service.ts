import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { SavedJobStatusDto } from './dto/saved-job-response.dto';
import { SavedJobsQueryDto } from './dto/saved-jobs-query.dto';

const publicJobWhere = {
  isActive: true,
} satisfies Prisma.JobWhereInput;

const publicJobSelect = {
  id: true,
  title: true,
  location: true,
  jobType: true,
  salaryMin: true,
  salaryMax: true,
  company: {
    select: {
      id: true,
      name: true,
    },
  },
} satisfies Prisma.JobSelect;

@Injectable()
export class SavedJobsService {
  constructor(private readonly prisma: PrismaService) {}

  async save(
    jobId: string,
    user: AuthenticatedUser,
  ): Promise<SavedJobStatusDto> {
    this.assertJobSeeker(user);

    return this.prisma.$transaction(async (tx) => {
      // Match apply(): eligibility and insertion share the job row lock.
      const rows = await tx.$queryRaw<{ id: string; isActive: boolean }[]>`
        SELECT id, "isActive"
        FROM "jobs"
        WHERE id = ${jobId}
        FOR UPDATE
      `;

      const job = rows[0];
      if (!job) {
        throw new NotFoundException('Job not found');
      }

      // Preserve idempotency for a previously saved job even if it is now inactive.
      const existing = await tx.savedJob.findUnique({
        where: {
          userId_jobId: { userId: user.id, jobId },
        },
        select: { jobId: true, createdAt: true },
      });

      if (existing) {
        return this.toStatus(existing);
      }

      if (!job.isActive) {
        throw new BadRequestException('This job is no longer available');
      }

      // The schema's unique constraint remains the final uniqueness guarantee.
      const saved = await tx.savedJob.upsert({
        where: {
          userId_jobId: { userId: user.id, jobId },
        },
        create: { userId: user.id, jobId },
        update: {},
        select: { jobId: true, createdAt: true },
      });

      return this.toStatus(saved);
    });
  }

  async remove(jobId: string, user: AuthenticatedUser): Promise<void> {
    this.assertJobSeeker(user);

    // Do not require the job to remain public or even exist.
    await this.prisma.savedJob.deleteMany({
      where: { userId: user.id, jobId },
    });
  }

  async findMine(user: AuthenticatedUser, query: SavedJobsQueryDto) {
    this.assertJobSeeker(user);

    if (query.jobIds !== undefined) {
      const jobIds = [...new Set(query.jobIds)];

      const rows = await this.prisma.savedJob.findMany({
        where: {
          userId: user.id,
          jobId: { in: jobIds },
          job: { is: publicJobWhere },
        },
        select: { jobId: true, createdAt: true },
      });

      const savedByJobId = new Map(rows.map((row) => [row.jobId, row]));

      return {
        data: jobIds.map((jobId): SavedJobStatusDto => {
          const saved = savedByJobId.get(jobId);

          return saved
            ? this.toStatus(saved)
            : { jobId, saved: false, savedAt: null };
        }),
      };
    }

    const { page, limit } = query;
    const where = {
      userId: user.id,
      job: { is: publicJobWhere },
    } satisfies Prisma.SavedJobWhereInput;

    const [total, rows] = await this.prisma.$transaction(
      [
        this.prisma.savedJob.count({ where }),
        this.prisma.savedJob.findMany({
          where,
          select: {
            jobId: true,
            createdAt: true,
            job: { select: publicJobSelect },
          },
          orderBy: [{ createdAt: 'desc' }, { jobId: 'asc' }],
          skip: (page - 1) * limit,
          take: limit,
        }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );

    return {
      data: rows.map((row) => ({
        ...this.toStatus(row),
        job: row.job,
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  private toStatus(row: {
    jobId: string;
    createdAt: Date;
  }): SavedJobStatusDto {
    return {
      jobId: row.jobId,
      saved: true,
      savedAt: row.createdAt.toISOString(),
    };
  }

  private assertJobSeeker(user: AuthenticatedUser): void {
    if (user.role !== Role.JOB_SEEKER) {
      throw new ForbiddenException('Only job seekers can manage saved jobs');
    }
  }
}
