import { Module } from '@nestjs/common';
import { CompaniesModule } from '../companies/companies.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ApplicationsController } from './applications.controller';
import { ApplicationsService } from './applications.service';
import { JobApplicationsController } from './job-applications.controller';

@Module({
  imports: [CompaniesModule, NotificationsModule],
  controllers: [JobApplicationsController, ApplicationsController],
  providers: [ApplicationsService],
})
export class ApplicationsModule {}
