import { describe, expect, it } from '@jest/globals';
import { BadRequestException } from '@nestjs/common';
import { ApplicationStatus } from '@prisma/client';
import { assertStatusTransition } from './application-status.rules';

describe('assertStatusTransition', () => {
  it('allows moving forward through the pipeline', () => {
    expect(() =>
      assertStatusTransition(ApplicationStatus.APPLIED, ApplicationStatus.REVIEWING),
    ).not.toThrow();
    expect(() =>
      assertStatusTransition(ApplicationStatus.REVIEWING, ApplicationStatus.SHORTLISTED),
    ).not.toThrow();
    expect(() =>
      assertStatusTransition(ApplicationStatus.SHORTLISTED, ApplicationStatus.ACCEPTED),
    ).not.toThrow();
  });

  it('allows rejecting directly from any non-final status', () => {
    expect(() =>
      assertStatusTransition(ApplicationStatus.APPLIED, ApplicationStatus.REJECTED),
    ).not.toThrow();
    expect(() =>
      assertStatusTransition(ApplicationStatus.SHORTLISTED, ApplicationStatus.REJECTED),
    ).not.toThrow();
  });

  it('allows moving backwards to correct a mistake', () => {
    expect(() =>
      assertStatusTransition(ApplicationStatus.SHORTLISTED, ApplicationStatus.REVIEWING),
    ).not.toThrow();
  });

  it('rejects changing to the same status', () => {
    expect(() =>
      assertStatusTransition(ApplicationStatus.REVIEWING, ApplicationStatus.REVIEWING),
    ).toThrow(BadRequestException);
  });

  it('freezes final statuses', () => {
    expect(() =>
      assertStatusTransition(ApplicationStatus.REJECTED, ApplicationStatus.REVIEWING),
    ).toThrow(BadRequestException);
    expect(() =>
      assertStatusTransition(ApplicationStatus.ACCEPTED, ApplicationStatus.REJECTED),
    ).toThrow(BadRequestException);
  });
});
