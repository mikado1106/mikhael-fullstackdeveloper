import { Module } from '@nestjs/common';
import { CompaniesModule } from '../companies/companies.module';
import { CompanyJobsController } from './company-jobs.controller';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';

@Module({
  imports: [CompaniesModule],
  controllers: [JobsController, CompanyJobsController],
  providers: [JobsService],
})
export class JobsModule {}
