import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ApplicationStatus, Prisma, Role } from '@prisma/client';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { CompaniesService } from '../companies/companies.service';
import { PrismaService } from '../prisma/prisma.service';
import { assertStatusTransition } from './application-status.rules';
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

const applicantSelect = { id: true, name: true, email: true } satisfies Prisma.UserSelect;

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly companiesService: CompaniesService,
  ) {}

  async apply(jobId: string, user: AuthenticatedUser, dto: CreateApplicationDto) {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      select: { id: true, isActive: true },
    });
    if (!job) {
      throw new NotFoundException('Job not found');
    }
    if (!job.isActive) {
      throw new BadRequestException('This job is no longer accepting applications');
    }

    try {
      return await this.prisma.application.create({
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
      // The @@unique([jobId, applicantId]) constraint is the real guard.
      if (isPrismaError(error, 'P2002')) {
        throw new ConflictException('You have already applied to this job');
      }
      throw error;
    }
  }

  findMine(user: AuthenticatedUser) {
    return this.prisma.application.findMany({
      where: { applicantId: user.id },
      include: { job: { select: jobSummarySelect } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findForJob(jobId: string, user: AuthenticatedUser) {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      select: { id: true, title: true, companyId: true },
    });
    if (!job) {
      throw new NotFoundException('Job not found');
    }
    await this.assertOwnsJob(job.companyId, user);

    const data = await this.prisma.application.findMany({
      where: { jobId },
      include: { applicant: { select: applicantSelect } },
      orderBy: { createdAt: 'desc' },
    });

    return { job: { id: job.id, title: job.title }, data };
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

    try {
      // Compare-and-set on the status we read: a concurrent change makes Prisma
      // throw P2025, which we turn into a 409 instead of silently overwriting.
      return await this.prisma.application.update({
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
  }

  private async assertOwnsJob(jobCompanyId: string, user: AuthenticatedUser): Promise<void> {
    const ownedCompanyId = await this.companiesService.getOwnedCompanyId(user.id);
    if (ownedCompanyId !== jobCompanyId) {
      throw new ForbiddenException('You can only manage applications for your own jobs');
    }
  }
}
