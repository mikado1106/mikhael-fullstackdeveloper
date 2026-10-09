import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import {
  ApplicationCvController,
  CvAuthenticatedGuard,
  CvCompanyGuard,
  CvController,
  CvSeekerGuard,
} from './cv.controller';
import { CleanupService } from './cleanup.service';
import { CvService } from './cv.service';
import { SupabaseStorageService } from './supabase-storage.service';

@Module({
  imports: [PrismaModule],
  controllers: [CvController, ApplicationCvController],
  providers: [
    CvService,
    SupabaseStorageService,
    CleanupService,
    CvAuthenticatedGuard,
    CvSeekerGuard,
    CvCompanyGuard,
  ],
  exports: [CvService, CleanupService],
})
export class CvModule {}
