import { ApplicationStatus } from '@prisma/client';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { AnalyticsService } from './analytics.service';
import { CompaniesService } from './companies.service';

describe('AnalyticsService', () => {
  const user = { id: 'owner-1' } as AuthenticatedUser;
  const companyId = 'company-owned-by-user';

  let prisma: {
    job: { findMany: jest.Mock };
    application: { groupBy: jest.Mock };
    $queryRaw: jest.Mock;
  };
  let companies: { getOwnedCompanyId: jest.Mock };
  let service: AnalyticsService;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-01T15:30:00.000Z'));

    prisma = {
      job: { findMany: jest.fn().mockResolvedValue([]) },
      application: {
        groupBy: jest.fn().mockResolvedValue([]),
      },
      $queryRaw: jest.fn().mockResolvedValue([]),
    };
    companies = {
      getOwnedCompanyId: jest.fn().mockResolvedValue(companyId),
    };
    service = new AnalyticsService(
      prisma as unknown as PrismaService,
      companies as unknown as CompaniesService,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('always returns all five status keys when groupBy is empty', async () => {
    prisma.job.findMany.mockResolvedValue([
      { id: 'job-1', title: 'Backend Engineer', isActive: true },
    ]);

    const result = await service.getAnalytics(user);

    expect(result.byStatus).toEqual({
      APPLIED: 0,
      REVIEWING: 0,
      SHORTLISTED: 0,
      REJECTED: 0,
      ACCEPTED: 0,
    });
    expect(Object.keys(result.byStatus)).toHaveLength(5);
    expect(result.byJob[0].byStatus).toEqual({});
  });

  it('keeps job status counts sparse and aggregates totals across jobs', async () => {
    prisma.job.findMany.mockResolvedValue([
      { id: 'job-1', title: 'Backend Engineer', isActive: true },
      { id: 'job-2', title: 'Frontend Engineer', isActive: false },
    ]);
    prisma.application.groupBy.mockResolvedValue([
      { jobId: 'job-1', status: ApplicationStatus.APPLIED, _count: { _all: 2 } },
      { jobId: 'job-1', status: ApplicationStatus.REVIEWING, _count: { _all: 0 } },
      { jobId: 'job-1', status: ApplicationStatus.ACCEPTED, _count: { _all: 1 } },
      { jobId: 'job-2', status: ApplicationStatus.APPLIED, _count: { _all: 3 } },
    ]);

    const result = await service.getAnalytics(user);

    expect(result.byJob).toEqual([
      {
        jobId: 'job-1',
        title: 'Backend Engineer',
        isActive: true,
        applications: 3,
        byStatus: { APPLIED: 2, ACCEPTED: 1 },
      },
      {
        jobId: 'job-2',
        title: 'Frontend Engineer',
        isActive: false,
        applications: 3,
        byStatus: { APPLIED: 3 },
      },
    ]);
    expect(result.byStatus).toEqual({
      APPLIED: 5,
      REVIEWING: 0,
      SHORTLISTED: 0,
      REJECTED: 0,
      ACCEPTED: 1,
    });
    expect(result.totals).toEqual({ jobs: 2, activeJobs: 1, applications: 6 });
    expect(
      result.byJob.every((job) => Object.values(job.byStatus).every((count) => count > 0)),
    ).toBe(true);
  });

  it('maps database day rows to applicationsByDay', async () => {
    prisma.$queryRaw.mockResolvedValue([
      { date: '2026-02-25', count: 2 },
      { date: '2026-02-28', count: 1 },
      { date: '2026-03-01', count: 3 },
    ]);

    const result = await service.getAnalytics(user);

    expect(result.applicationsByDay).toEqual([
      { date: '2026-02-25', count: 2 },
      { date: '2026-02-28', count: 1 },
      { date: '2026-03-01', count: 3 },
    ]);
  });

  it('returns zero totals and empty arrays for an empty company', async () => {
    await expect(service.getAnalytics(user)).resolves.toEqual({
      totals: { jobs: 0, activeJobs: 0, applications: 0 },
      byStatus: {
        APPLIED: 0,
        REVIEWING: 0,
        SHORTLISTED: 0,
        REJECTED: 0,
        ACCEPTED: 0,
      },
      byJob: [],
      applicationsByDay: [],
    });
  });

  it('uses the owned company ID in every query and a bounded 30-day UTC window', async () => {
    await service.getAnalytics(user);

    expect(companies.getOwnedCompanyId).toHaveBeenCalledTimes(1);
    expect(companies.getOwnedCompanyId).toHaveBeenCalledWith(user.id);
    expect(prisma.job.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.job.findMany).toHaveBeenCalledWith({
      where: { companyId },
      select: { id: true, title: true, isActive: true },
    });
    expect(prisma.application.groupBy).toHaveBeenCalledTimes(1);
    expect(prisma.application.groupBy).toHaveBeenCalledWith({
      by: ['jobId', 'status'],
      where: { job: { companyId } },
      _count: { _all: true },
    });
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    const [strings, ...values] = prisma.$queryRaw.mock.calls[0] as unknown as [
      TemplateStringsArray,
      ...unknown[],
    ];
    expect(values).toEqual([
      companyId,
      new Date('2026-01-31T00:00:00.000Z'),
      new Date('2026-03-02T00:00:00.000Z'),
    ]);
    expect(strings.join('')).toContain('GROUP BY');
  });
});
