import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { ApplicationsService } from './applications.service';
import { CreateApplicationDto } from './dto/create-application.dto';

/** Application endpoints scoped to a job: apply, and list candidates. */
@Controller('jobs/:jobId/applications')
export class JobApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @Post()
  @Roles(Role.JOB_SEEKER)
  apply(
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto?: CreateApplicationDto,
  ) {
    return this.applicationsService.apply(jobId, user, dto ?? {});
  }

  @Get()
  @Roles(Role.COMPANY)
  findForJob(@Param('jobId', ParseUUIDPipe) jobId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.applicationsService.findForJob(jobId, user);
  }
}
