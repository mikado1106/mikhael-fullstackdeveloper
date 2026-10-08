import { Controller, Get } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { AnalyticsService } from './analytics.service';

@Controller('companies')
export class CompaniesController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('me/analytics')
  @Roles(Role.COMPANY)
  getAnalytics(@CurrentUser() user: AuthenticatedUser) {
    return this.analyticsService.getAnalytics(user);
  }
}
