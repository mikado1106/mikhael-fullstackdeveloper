import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { CompaniesService } from '../companies/companies.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateJobDto } from './dto/create-job.dto';
import { QueryJobsDto } from './dto/query-jobs.dto';

const companySummarySelect = {
  id: true,
  name: true,
  location: true,
} satisfies Prisma.CompanySelect;

// List view: description is searchable but not included in the payload.
const jobListSelect = {
  id: true,
  title: true,
  location: true,
  salaryMin: true,
  salaryMax: true,
  jobType: true,
  isActive: true,
  createdAt: true,
  company: { select: companySummarySelect },
} satisfies Prisma.JobSelect;

function escapeLikeLiteral(value: string): string {
  // Prisma's PostgreSQL contains filter wraps this in an ILIKE pattern.
  // Escape its pattern metacharacters, including the escape character itself.
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

function validateSalaryFilter(salaryMin?: number, salaryMax?: number): void {
  for (const value of [salaryMin, salaryMax]) {
    if (
      value !== undefined &&
      (!Number.isInteger(value) || value < 0 || value > 2147483647)
    ) {
      throw new BadRequestException(
        'Salary filters must be integers between 0 and 2147483647',
      );
    }
  }

  if (
    salaryMin !== undefined &&
    salaryMax !== undefined &&
    salaryMin > salaryMax
  ) {
    throw new BadRequestException('salaryMax must be greater than or equal to salaryMin');
  }
}

@Injectable()
export class JobsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companiesService: CompaniesService,
  ) {}

  async findAll(query: QueryJobsDto) {
    const { page, limit, search, jobType, location, salaryMin, salaryMax } = query;
    validateSalaryFilter(salaryMin, salaryMax);

    const insensitive = Prisma.QueryMode.insensitive;
    const searchLiteral = search ? escapeLikeLiteral(search) : undefined;
    const locationLiteral = location ? escapeLikeLiteral(location) : undefined;
    const salaryConditions: Prisma.JobWhereInput[] = [];

    if (salaryMin !== undefined || salaryMax !== undefined) {
      // Two null bounds mean undisclosed salary, not an unrestricted interval.
      salaryConditions.push({
        OR: [{ salaryMin: { not: null } }, { salaryMax: { not: null } }],
      });

      // Inclusive intersection: job upper >= requested lower, and
      // job lower <= requested upper. A single null job bound is open.
      if (salaryMin !== undefined) {
        salaryConditions.push({
          OR: [{ salaryMax: null }, { salaryMax: { gte: salaryMin } }],
        });
      }

      if (salaryMax !== undefined) {
        salaryConditions.push({
          OR: [{ salaryMin: null }, { salaryMin: { lte: salaryMax } }],
        });
      }
    }

    const where: Prisma.JobWhereInput = {
      isActive: true,
      ...(jobType ? { jobType } : {}),
      ...(locationLiteral
        ? { location: { contains: locationLiteral, mode: insensitive } }
        : {}),
      ...(searchLiteral
        ? {
            OR: [
              { title: { contains: searchLiteral, mode: insensitive } },
              { description: { contains: searchLiteral, mode: insensitive } },
              { company: { name: { contains: searchLiteral, mode: insensitive } } },
            ],
          }
        : {}),
      ...(salaryConditions.length > 0 ? { AND: salaryConditions } : {}),
    };

    const [total, data] = await this.prisma.$transaction([
      this.prisma.job.count({ where }),
      this.prisma.job.findMany({
        where,
        select: jobListSelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const meta = {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
    return { data, meta };
  }

  async findOne(id: string, user?: AuthenticatedUser) {
    const job = await this.prisma.job.findUnique({
      where: { id },
      include: {
        company: { select: { ...companySummarySelect, description: true } },
        _count: { select: { applications: true } },
      },
    });
    if (!job) {
      throw new NotFoundException('Job not found');
    }

    // Anonymous visitors and company users always get null.
    const myApplication =
      user?.role === Role.JOB_SEEKER
        ? await this.prisma.application.findUnique({
            where: { jobId_applicantId: { jobId: id, applicantId: user.id } },
            select: { id: true, status: true, createdAt: true },
          })
        : null;

    const { _count, ...jobFields } = job;
    return { ...jobFields, applicationsCount: _count.applications, myApplication };
  }

  async create(dto: CreateJobDto, user: AuthenticatedUser) {
    if (dto.salaryMax < dto.salaryMin) {
      throw new BadRequestException('salaryMax must be greater than or equal to salaryMin');
    }
    const companyId = await this.companiesService.getOwnedCompanyId(user.id);

    return this.prisma.job.create({
      data: { ...dto, companyId },
      include: { company: { select: companySummarySelect } },
    });
  }

  /** Jobs posted by the company of the current user, with applicant counts. */
  async findOwnedByUser(user: AuthenticatedUser) {
    const companyId = await this.companiesService.getOwnedCompanyId(user.id);

    const jobs = await this.prisma.job.findMany({
      where: { companyId },
      include: { _count: { select: { applications: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return jobs.map(({ _count, ...job }) => ({ ...job, applicationsCount: _count.applications }));
  }
}
