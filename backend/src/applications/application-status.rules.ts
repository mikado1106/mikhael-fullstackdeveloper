import { BadRequestException } from '@nestjs/common';
import { ApplicationStatus } from '@prisma/client';

const FINAL_STATUSES: ApplicationStatus[] = [
  ApplicationStatus.REJECTED,
  ApplicationStatus.ACCEPTED,
];

// A company can move freely between the non-final stages, including backwards.
// Final statuses are frozen.
export function assertStatusTransition(current: ApplicationStatus, next: ApplicationStatus): void {
  if (FINAL_STATUSES.includes(current)) {
    throw new BadRequestException(`Application is already ${current} and can no longer be changed`);
  }
  if (current === next) {
    throw new BadRequestException(`Application is already in status ${next}`);
  }
}
