import { BadRequestException } from '@nestjs/common';
import { JobType, Prisma } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CompaniesService } from '../companies/companies.service';
import { PrismaService } from '../prisma/prisma.service';
import { QueryJobsDto } from './dto/query-jobs.dto';
import { JobsService } from './jobs.service';

type SalaryFixture = {
  salaryMin: number | null;
  salaryMax: number | null;
};

// A deliberately small evaluator for the salary predicate emitted by findAll.
// It verifies predicate semantics, not Prisma/PostgreSQL execution behavior.
function matchesSalaryWhere(
  job: SalaryFixture,
  where: Prisma.JobWhereInput,
): boolean {
  const and = where.AND;
  if (and) {
    const conditions = Array.isArray(and) ? and : [and];
    if (!conditions.every((condition) => matchesSalaryWhere(job, condition))) {
      return false;
    }
  }

  if (
    where.OR &&
    !where.OR.some((condition) => matchesSalaryWhere(job, condition))
  ) {
    return false;
  }

  for (const field of ['salaryMin', 'salaryMax'] as const) {
    const filter = where[field];
    const value = job[field];

    if (filter === undefined) {
      continue;
    }
    if (filter === null || typeof filter === 'number') {
      if (value !== filter) {
        return false;
      }
      continue;
    }

    if (filter.not === null && value === null) {
      return false;
    }
    if (typeof filter.gte === 'number') {
      if (value === null || value < filter.gte) {
        return false;
      }
    }
    if (typeof filter.lte === 'number') {
      if (value === null || value > filter.lte) {
        return false;
      }
    }
  }

  return true;
}

describe('JobsService.findAll', () => {
  let service: JobsService;
  let count: jest.Mock;
  let findMany: jest.Mock;
  let transaction: jest.Mock;

  function query(overrides: Partial<QueryJobsDto> = {}): QueryJobsDto {
    return Object.assign(new QueryJobsDto(), {
      page: 1,
      limit: 10,
      ...overrides,
    });
  }

  function capturedWhere(): Prisma.JobWhereInput {
    return findMany.mock.calls[0][0].where as Prisma.JobWhereInput;
  }

  beforeEach(() => {
    count = jest.fn().mockResolvedValue(0);
    findMany = jest.fn().mockResolvedValue([]);
    transaction = jest.fn((operations: Promise<unknown>[]) =>
      Promise.all(operations),
    );

    const prisma = {
      job: { count, findMany },
      $transaction: transaction,
    } as unknown as PrismaService;

    const companiesService = {
      getOwnedCompanyId: jest.fn(),
    } as unknown as CompaniesService;

    service = new JobsService(prisma, companiesService);
  });

  it('builds inclusive intersection predicates, not containment predicates', async () => {
    await service.findAll(query({ salaryMin: 5000000, salaryMax: 10000000 }));

    const where = capturedWhere();
    expect(where).toEqual({
      isActive: true,
      AND: [
        { OR: [{ salaryMin: { not: null } }, { salaryMax: { not: null } }] },
        { OR: [{ salaryMax: null }, { salaryMax: { gte: 5000000 } }] },
        { OR: [{ salaryMin: null }, { salaryMin: { lte: 10000000 } }] },
      ],
    });

    const fixtures: Array<[SalaryFixture, boolean]> = [
      [{ salaryMin: 4000000, salaryMax: 6000000 }, true],
      [{ salaryMin: 9000000, salaryMax: 12000000 }, true],
      [{ salaryMin: 1000000, salaryMax: 20000000 }, true],
      [{ salaryMin: 6000000, salaryMax: 7000000 }, true],
      [{ salaryMin: 1000000, salaryMax: 5000000 }, true],
      [{ salaryMin: 10000000, salaryMax: 12000000 }, true],
      [{ salaryMin: 1000000, salaryMax: 4999999 }, false],
      [{ salaryMin: 10000001, salaryMax: 12000000 }, false],
      [{ salaryMin: null, salaryMax: 6000000 }, true],
      [{ salaryMin: 9000000, salaryMax: null }, true],
      [{ salaryMin: null, salaryMax: 4999999 }, false],
      [{ salaryMin: 10000001, salaryMax: null }, false],
      [{ salaryMin: null, salaryMax: null }, false],
    ];

    for (const [fixture, expected] of fixtures) {
      expect({ fixture, matches: matchesSalaryWhere(fixture, where) }).toEqual({
        fixture,
        matches: expected,
      });
    }
  });

  it('supports a lower-only interval with an open job upper bound', async () => {
    await service.findAll(query({ salaryMin: 5000000 }));

    const where = capturedWhere();
    expect(where.AND).toEqual([
      { OR: [{ salaryMin: { not: null } }, { salaryMax: { not: null } }] },
      { OR: [{ salaryMax: null }, { salaryMax: { gte: 5000000 } }] },
    ]);

    expect(matchesSalaryWhere({ salaryMin: 1000000, salaryMax: null }, where)).toBe(true);
    expect(matchesSalaryWhere({ salaryMin: null, salaryMax: 5000000 }, where)).toBe(true);
    expect(matchesSalaryWhere({ salaryMin: null, salaryMax: 4999999 }, where)).toBe(false);
    expect(matchesSalaryWhere({ salaryMin: null, salaryMax: null }, where)).toBe(false);
  });

  it('supports an upper-only interval with an open job lower bound', async () => {
    await service.findAll(query({ salaryMax: 5000000 }));

    const where = capturedWhere();
    expect(where.AND).toEqual([
      { OR: [{ salaryMin: { not: null } }, { salaryMax: { not: null } }] },
      { OR: [{ salaryMin: null }, { salaryMin: { lte: 5000000 } }] },
    ]);

    expect(matchesSalaryWhere({ salaryMin: null, salaryMax: 9000000 }, where)).toBe(true);
    expect(matchesSalaryWhere({ salaryMin: 5000000, salaryMax: null }, where)).toBe(true);
    expect(matchesSalaryWhere({ salaryMin: 5000001, salaryMax: null }, where)).toBe(false);
    expect(matchesSalaryWhere({ salaryMin: null, salaryMax: null }, where)).toBe(false);
  });

  it('treats zero as a supplied bound and accepts equal interval endpoints', async () => {
    await service.findAll(query({ salaryMin: 0, salaryMax: 0 }));

    const where = capturedWhere();
    expect(where.AND).toEqual([
      { OR: [{ salaryMin: { not: null } }, { salaryMax: { not: null } }] },
      { OR: [{ salaryMax: null }, { salaryMax: { gte: 0 } }] },
      { OR: [{ salaryMin: null }, { salaryMin: { lte: 0 } }] },
    ]);

    expect(matchesSalaryWhere({ salaryMin: 0, salaryMax: 0 }, where)).toBe(true);
    expect(matchesSalaryWhere({ salaryMin: 1, salaryMax: null }, where)).toBe(false);
  });

  it('keeps undisclosed salaries when no salary filter is supplied', async () => {
    const row = {
      id: 'job-null-salary',
      title: 'Engineer',
      location: 'Jakarta',
      salaryMin: null,
      salaryMax: null,
      jobType: JobType.FULL_TIME,
      isActive: true,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      company: { id: 'company-1', name: 'Company', location: null },
    };
    count.mockResolvedValue(1);
    findMany.mockResolvedValue([row]);

    const result = await service.findAll(query());

    expect(capturedWhere()).toEqual({ isActive: true });
    expect(result.data).toEqual([row]);
    expect(result.data[0].salaryMin).toBeNull();
    expect(result.data[0].salaryMax).toBeNull();
    expect(result.meta).toEqual({ page: 1, limit: 10, total: 1, totalPages: 1 });
  });

  it('escapes percent, underscore and backslash in every keyword field', async () => {
    await service.findAll(query({ search: '100%_\\PDF' }));

    const escaped = '100\\%\\_\\\\PDF';
    expect(capturedWhere().OR).toEqual([
      { title: { contains: escaped, mode: Prisma.QueryMode.insensitive } },
      { description: { contains: escaped, mode: Prisma.QueryMode.insensitive } },
      { company: { name: { contains: escaped, mode: Prisma.QueryMode.insensitive } } },
    ]);
    expect(findMany.mock.calls[0][0].select.description).toBeUndefined();
  });

  it('escapes literal wildcard characters in location too', async () => {
    await service.findAll(query({ location: 'Area_50%\\West' }));

    expect(capturedWhere().location).toEqual({
      contains: 'Area\\_50\\%\\\\West',
      mode: Prisma.QueryMode.insensitive,
    });
  });

  it('combines keyword, location, job type and salary filters without overwriting OR', async () => {
    await service.findAll(
      query({
        search: 'engineer',
        location: 'Jakarta',
        jobType: JobType.FULL_TIME,
        salaryMin: 0,
        salaryMax: 2147483647,
      }),
    );

    const where = capturedWhere();
    expect(where.isActive).toBe(true);
    expect(where.jobType).toBe(JobType.FULL_TIME);
    expect(where.location).toEqual({
      contains: 'Jakarta',
      mode: Prisma.QueryMode.insensitive,
    });
    expect(where.OR).toHaveLength(3);
    expect(where.AND).toHaveLength(3);
    expect(count.mock.calls[0][0].where).toEqual(where);
  });

  it('uses identical count/list predicates and stable ordering with pagination', async () => {
    count.mockResolvedValue(25);

    const result = await service.findAll(query({ page: 2, limit: 10 }));

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: count.mock.calls[0][0].where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: 10,
        take: 10,
      }),
    );
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(result.meta).toEqual({ page: 2, limit: 10, total: 25, totalPages: 3 });
  });

  it('preserves the existing minimum totalPages of one for empty results', async () => {
    const result = await service.findAll(query());

    expect(result).toEqual({
      data: [],
      meta: { page: 1, limit: 10, total: 0, totalPages: 1 },
    });
  });

  it('rejects reversed salary bounds before querying the database', async () => {
    await expect(
      service.findAll(query({ salaryMin: 10000000, salaryMax: 5000000 })),
    ).rejects.toThrow(BadRequestException);

    expect(count).not.toHaveBeenCalled();
    expect(findMany).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
  });

  it.each([-1, 1.5, 2147483648, NaN, Infinity])(
    'defensively rejects invalid salary bound %s',
    async (value) => {
      await expect(
        service.findAll(query({ salaryMin: value })),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.findAll(query({ salaryMax: value })),
      ).rejects.toThrow(BadRequestException);

      expect(transaction).not.toHaveBeenCalled();
    },
  );
});

describe('QueryJobsDto salary validation', () => {
  function dto(input: Record<string, unknown>): QueryJobsDto {
    return plainToInstance(QueryJobsDto, {
      page: 1,
      limit: 10,
      ...input,
    });
  }

  it.each(['salaryMin', 'salaryMax'])(
    'accepts omitted %s',
    async (field) => {
      const value = dto({});
      const errors = await validate(value);

      expect(value[field as 'salaryMin' | 'salaryMax']).toBeUndefined();
      expect(errors.filter((error) => error.property === field)).toEqual([]);
    },
  );

  it.each([
    ['0', 0],
    ['5000000', 5000000],
    ['2147483647', 2147483647],
  ])('parses valid query integer %s', async (input, expected) => {
    const value = dto({ salaryMin: input, salaryMax: input });
    const errors = await validate(value);

    expect(value.salaryMin).toBe(expected);
    expect(value.salaryMax).toBe(expected);
    expect(
      errors.filter((error) =>
        ['salaryMin', 'salaryMax'].includes(error.property),
      ),
    ).toEqual([]);
  });

  const invalidInputs: unknown[] = [
    '',
    ' ',
    '-1',
    '1.5',
    '1e6',
    '0x10',
    'Infinity',
    'NaN',
    '2147483648',
    '5000000abc',
    ['1', '2'],
    null,
    true,
    {},
  ];

  it.each(invalidInputs.map((input) => [input]))(
    'rejects invalid salary query value %p',
    async (input) => {
      const errors = await validate(dto({ salaryMin: input, salaryMax: input }));
      const properties = errors.map((error) => error.property);

      expect(properties).toContain('salaryMin');
      expect(properties).toContain('salaryMax');
    },
  );

  it('does not accept exponent notation even with implicit conversion enabled', async () => {
    const value = plainToInstance(
      QueryJobsDto,
      { page: 1, limit: 10, salaryMin: '1e6' },
      { enableImplicitConversion: true },
    );

    const errors = await validate(value);
    expect(errors.map((error) => error.property)).toContain('salaryMin');
  });
});
