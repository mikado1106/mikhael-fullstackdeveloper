import { Injectable } from '@nestjs/common';
import { ApplicationStatus } from '@prisma/client';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { CompaniesService } from './companies.service';

export interface JobAnalytics {
  jobId: string;
  title: string;
  isActive: boolean;
  applications: number;
  byStatus: Partial<Record<ApplicationStatus, number>>;
}

export interface CompanyAnalytics {
  totals: {
    jobs: number;
    activeJobs: number;
    applications: number;
  };
  byStatus: Record<ApplicationStatus, number>;
  byJob: JobAnalytics[];
  applicationsByDay: { date: string; count: number }[];
}

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companiesService: CompaniesService,
  ) {}

  async getAnalytics(user: AuthenticatedUser): Promise<CompanyAnalytics> {
    const companyId = await this.companiesService.getOwnedCompanyId(user.id);
    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    since.setUTCDate(since.getUTCDate() - 29);
    const until = new Date(since);
    until.setUTCDate(until.getUTCDate() + 30);

    const [jobs, groupedApplications, dayRows] = await Promise.all([
      this.prisma.job.findMany({
        where: { companyId },
        select: { id: true, title: true, isActive: true },
      }),
      this.prisma.application.groupBy({
        by: ['jobId', 'status'],
        where: { job: { companyId } },
        _count: { _all: true },
      }),
      this.prisma.$queryRaw<{ date: string; count: number }[]>`
        SELECT TO_CHAR("createdAt", 'YYYY-MM-DD') AS date, COUNT(*)::int AS count
        FROM "applications"
        WHERE "jobId" IN (SELECT id FROM "jobs" WHERE "companyId" = ${companyId})
          AND "createdAt" >= ${since} AND "createdAt" < ${until}
        GROUP BY 1
        ORDER BY 1`,
    ]);

    const byStatus: Record<ApplicationStatus, number> = {
      APPLIED: 0,
      REVIEWING: 0,
      SHORTLISTED: 0,
      REJECTED: 0,
      ACCEPTED: 0,
    };

    const byJob: JobAnalytics[] = jobs.map((job) => ({
      jobId: job.id,
      title: job.title,
      isActive: job.isActive,
      applications: 0,
      byStatus: {},
    }));
    const jobsById = new Map(byJob.map((job) => [job.jobId, job]));

    let applications = 0;
    for (const group of groupedApplications) {
      const count = group._count._all;
      applications += count;
      byStatus[group.status] += count;

      const job = jobsById.get(group.jobId);
      if (job && count > 0) {
        job.applications += count;
        job.byStatus[group.status] = count;
      }
    }

    const applicationsByDay = dayRows.map((row) => ({ date: row.date, count: row.count }));

    return {
      totals: {
        jobs: jobs.length,
        activeJobs: jobs.filter((job) => job.isActive).length,
        applications,
      },
      byStatus,
      byJob,
      applicationsByDay,
    };
  }
}
