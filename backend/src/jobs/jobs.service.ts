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

// List view: no description.
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

@Injectable()
export class JobsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companiesService: CompaniesService,
  ) {}

  async findAll(query: QueryJobsDto) {
    const { page, limit, search, jobType, location } = query;
    const insensitive = Prisma.QueryMode.insensitive;

    const where: Prisma.JobWhereInput = {
      isActive: true,
      ...(jobType ? { jobType } : {}),
      ...(location ? { location: { contains: location, mode: insensitive } } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: insensitive } },
              { company: { name: { contains: search, mode: insensitive } } },
            ],
          }
        : {}),
    };

    const [total, data] = await this.prisma.$transaction([
      this.prisma.job.count({ where }),
      this.prisma.job.findMany({
        where,
        select: jobListSelect,
        orderBy: { createdAt: 'desc' },
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

    // Tell a job seeker whether they already applied so the UI can disable the button.
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
