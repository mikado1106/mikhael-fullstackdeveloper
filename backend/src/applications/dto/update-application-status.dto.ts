import { ApplicationStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateApplicationStatusDto {
  @IsEnum(ApplicationStatus)
  status!: ApplicationStatus;

  /** Optional remark stored in the history entry (e.g. interview date). */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
