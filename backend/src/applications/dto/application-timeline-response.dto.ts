import { ApplicationStatus } from '@prisma/client';

export class ApplicationTimelineEntryDto {
  id!: string;
  status!: ApplicationStatus;
  occurredAt!: string;
}

export class ApplicationTimelineResponseDto {
  applicationId!: string;
  currentStatus!: ApplicationStatus;
  history!: ApplicationTimelineEntryDto[];
}
