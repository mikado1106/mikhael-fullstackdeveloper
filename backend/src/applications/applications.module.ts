import { Module } from '@nestjs/common';
import { CompaniesModule } from '../companies/companies.module';
import { ApplicationsController } from './applications.controller';
import { ApplicationsService } from './applications.service';
import { JobApplicationsController } from './job-applications.controller';

@Module({
  imports: [CompaniesModule],
  controllers: [JobApplicationsController, ApplicationsController],
  providers: [ApplicationsService],
})
export class ApplicationsModule {}
