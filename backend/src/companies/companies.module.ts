import { Module } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { CompaniesController } from './companies.controller';
import { CompaniesService } from './companies.service';

@Module({
  controllers: [CompaniesController],
  providers: [CompaniesService, AnalyticsService],
  exports: [CompaniesService],
})
export class CompaniesModule {}
