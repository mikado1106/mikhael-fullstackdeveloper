import { Controller, Get } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { JobsService } from './jobs.service';

/** Company-scoped view of jobs: "my postings". */
@Controller('companies')
export class CompanyJobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Get('me/jobs')
  @Roles(Role.COMPANY)
  findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.jobsService.findOwnedByUser(user);
  }
}
