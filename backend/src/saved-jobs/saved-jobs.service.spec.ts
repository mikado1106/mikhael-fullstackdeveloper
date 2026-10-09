import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { SavedJobsService } from './saved-jobs.service';

describe('SavedJobsService', () => {
  const user = {
    id: 'user-1',
    role: Role.JOB_SEEKER,
  } as AuthenticatedUser;
  const createdAt = new Date('2026-01-02T03:04:05.000Z');

  let service: SavedJobsService;
  let prisma: {
    $transaction: jest.Mock;
    savedJob: {
      findUnique: jest.Mock;
      upsert: jest.Mock;
      deleteMany: jest.Mock;
      count: jest.Mock;
      findMany: jest.Mock;
    };
  };
  let tx: {
    $queryRaw: jest.Mock;
    savedJob: typeof prisma.savedJob;
  };

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn(),
      savedJob: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({ jobId: 'job-1', createdAt }),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: 'job-1', isActive: true }]),
      savedJob: prisma.savedJob,
    };

    prisma.$transaction.mockImplementation(async (operation) =>
      typeof operation === 'function' ? operation(tx) : Promise.all(operation),
    );

    service = new SavedJobsService(prisma as unknown as PrismaService);
  });

  it('creates a save using JWT identity and returns a UTC timestamp', async () => {
    await expect(service.save('job-1', user)).resolves.toEqual({
      jobId: 'job-1',
      saved: true,
      savedAt: '2026-01-02T03:04:05.000Z',
    });

    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    const [sql, parameter] = tx.$queryRaw.mock.calls[0];
    expect(sql.join('')).toContain('FOR UPDATE');
    expect(parameter).toBe('job-1');

    expect(prisma.savedJob.upsert).toHaveBeenCalledWith({
      where: {
        userId_jobId: { userId: 'user-1', jobId: 'job-1' },
      },
      create: { userId: 'user-1', jobId: 'job-1' },
      update: {},
      select: { jobId: true, createdAt: true },
    });
  });

  it('returns the original timestamp without writing on repeated POST', async () => {
    prisma.savedJob.findUnique.mockResolvedValue({ jobId: 'job-1', createdAt });

    const first = await service.save('job-1', user);
    const second = await service.save('job-1', user);

    expect(first).toEqual(second);
    expect(prisma.savedJob.upsert).not.toHaveBeenCalled();
  });

  it('preserves an existing save after the job becomes inactive', async () => {
    tx.$queryRaw.mockResolvedValue([{ id: 'job-1', isActive: false }]);
    prisma.savedJob.findUnique.mockResolvedValue({ jobId: 'job-1', createdAt });

    await expect(service.save('job-1', user)).resolves.toEqual({
      jobId: 'job-1',
      saved: true,
      savedAt: createdAt.toISOString(),
    });
    expect(prisma.savedJob.upsert).not.toHaveBeenCalled();
  });

  it('rejects a new save for an inactive job', async () => {
    tx.$queryRaw.mockResolvedValue([{ id: 'job-1', isActive: false }]);

    await expect(service.save('job-1', user)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.savedJob.upsert).not.toHaveBeenCalled();
  });

  it('returns 404 for a missing job', async () => {
    tx.$queryRaw.mockResolvedValue([]);

    await expect(service.save('missing', user)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.savedJob.upsert).not.toHaveBeenCalled();
  });

  it('keeps one row under concurrent saves with simulated database locking', async () => {
    const rows = new Map<string, { jobId: string; createdAt: Date }>();
    let lock = Promise.resolve();

    // Unit simulation of the transaction lock, not a substitute for a DB integration test.
    prisma.$transaction.mockImplementation(
      (operation: (client: typeof tx) => Promise<unknown>) => {
        const result = lock.then(() => operation(tx));
        lock = result.then(() => undefined, () => undefined);
        return result;
      },
    );

    prisma.savedJob.findUnique.mockImplementation(async ({ where }) =>
      rows.get(`${where.userId_jobId.userId}:${where.userId_jobId.jobId}`) ?? null,
    );

    prisma.savedJob.upsert.mockImplementation(async ({ create }) => {
      const key = `${create.userId}:${create.jobId}`;
      if (!rows.has(key)) {
        rows.set(key, { jobId: create.jobId, createdAt });
      }
      return rows.get(key);
    });

    const results = await Promise.all(
      Array.from({ length: 20 }, () => service.save('job-1', user)),
    );

    expect(rows.size).toBe(1);
    expect(prisma.savedJob.upsert).toHaveBeenCalledTimes(1);
    expect(results.every((result) => result.savedAt === createdAt.toISOString())).toBe(
      true,
    );
  });

  it('DELETE remains successful when no saved row exists', async () => {
    await expect(service.remove('missing', user)).resolves.toBeUndefined();
    await expect(service.remove('missing', user)).resolves.toBeUndefined();

    expect(prisma.savedJob.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', jobId: 'missing' },
    });
    expect(tx.$queryRaw).not.toHaveBeenCalled();
  });

  it('scopes lookup to the authenticated user and public jobs', async () => {
    prisma.savedJob.findMany.mockResolvedValue([
      {
        jobId: 'job-1',
        createdAt,
        userId: 'user-1',
        privateField: 'must not leak',
      },
    ]);

    const response = await service.findMine(user, {
      page: 1,
      limit: 10,
      jobIds: ['job-1', 'job-2', 'job-1'],
    });

    expect(prisma.savedJob.findMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        jobId: { in: ['job-1', 'job-2'] },
        job: { is: { isActive: true } },
      },
      select: { jobId: true, createdAt: true },
    });
    expect(response).toEqual({
      data: [
        { jobId: 'job-1', saved: true, savedAt: createdAt.toISOString() },
        { jobId: 'job-2', saved: false, savedAt: null },
      ],
    });
  });

  it('uses the same public-only filter for list and count', async () => {
    await expect(
      service.findMine(user, { page: 2, limit: 10 }),
    ).resolves.toEqual({
      data: [],
      meta: { page: 2, limit: 10, total: 0, totalPages: 1 },
    });

    const where = {
      userId: 'user-1',
      job: { is: { isActive: true } },
    };

    expect(prisma.savedJob.count).toHaveBeenCalledWith({ where });
    expect(prisma.savedJob.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where,
        skip: 10,
        take: 10,
        orderBy: [{ createdAt: 'desc' }, { jobId: 'asc' }],
      }),
    );
    expect(prisma.$transaction).toHaveBeenCalledWith(
      expect.any(Array),
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  });

  it('rejects non-job-seekers before any database access', async () => {
    const otherUser = {
      ...user,
      role: 'NOT_A_JOB_SEEKER' as Role,
    };

    await expect(service.save('job-1', otherUser)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(service.remove('job-1', otherUser)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(
      service.findMine(otherUser, { page: 1, limit: 10 }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.savedJob.deleteMany).not.toHaveBeenCalled();
    expect(prisma.savedJob.findMany).not.toHaveBeenCalled();
  });
});
