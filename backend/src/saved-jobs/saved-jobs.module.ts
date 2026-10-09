import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SavedJobsController } from './saved-jobs.controller';
import { SavedJobsService } from './saved-jobs.service';

@Module({
  imports: [PrismaModule],
  controllers: [SavedJobsController],
  providers: [SavedJobsService],
  exports: [SavedJobsService],
})
export class SavedJobsModule {}
