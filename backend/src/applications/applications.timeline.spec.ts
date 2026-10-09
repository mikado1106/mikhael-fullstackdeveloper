import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ApplicationStatus, Role } from '@prisma/client';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { CompaniesService } from '../companies/companies.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { ApplicationsService } from './applications.service';

describe('ApplicationsService.getTimeline', () => {
  const user = {
    id: 'applicant-1',
    role: Role.JOB_SEEKER,
  } as AuthenticatedUser;

  let service: ApplicationsService;
  let findUnique: jest.Mock;
  let getOwnedCompanyId: jest.Mock;

  beforeEach(() => {
    findUnique = jest.fn();
    getOwnedCompanyId = jest.fn();

    const tx = { application: { findUnique } };
    const prisma = {
      $transaction: jest.fn(async (operation) => operation(tx)),
    };

    service = new ApplicationsService(
      prisma as unknown as PrismaService,
      { getOwnedCompanyId } as unknown as CompaniesService,
      {} as NotificationsService,
    );
  });

  it('uses Application.status and returns only allowlisted history fields', async () => {
    findUnique.mockResolvedValue({
      id: 'application-1',
      applicantId: user.id,
      status: ApplicationStatus.APPLIED,
      job: { companyId: 'company-1' },
      history: [
        {
          id: 'history-1',
          toStatus: ApplicationStatus.APPLIED,
          createdAt: new Date('2026-01-02T10:00:00+07:00'),
          note: 'Private note',
          changedById: 'private-actor',
        },
      ],
    });

    await expect(service.getTimeline('application-1', user)).resolves.toEqual({
      applicationId: 'application-1',
      currentStatus: ApplicationStatus.APPLIED,
      history: [
        {
          id: 'history-1',
          status: ApplicationStatus.APPLIED,
          occurredAt: '2026-01-02T03:00:00.000Z',
        },
      ],
    });

    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          history: {
            select: { id: true, toStatus: true, createdAt: true },
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          },
        }),
      }),
    );
  });

  it('returns an empty history without synthesizing entries', async () => {
    findUnique.mockResolvedValue({
      id: 'application-1',
      applicantId: user.id,
      status: ApplicationStatus.APPLIED,
      job: { companyId: 'company-1' },
      history: [],
    });

    await expect(service.getTimeline('application-1', user)).resolves.toEqual({
      applicationId: 'application-1',
      currentStatus: ApplicationStatus.APPLIED,
      history: [],
    });
  });

  it('rejects another applicant', async () => {
    findUnique.mockResolvedValue({
      id: 'application-1',
      applicantId: 'another-applicant',
      status: ApplicationStatus.APPLIED,
      job: { companyId: 'company-1' },
      history: [],
    });

    await expect(service.getTimeline('application-1', user)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('checks company ownership for non-job-seekers', async () => {
    findUnique.mockResolvedValue({
      id: 'application-1',
      applicantId: user.id,
      status: ApplicationStatus.APPLIED,
      job: { companyId: 'company-1' },
      history: [],
    });
    getOwnedCompanyId.mockResolvedValue('another-company');

    const employer = {
      id: 'employer-1',
      role: 'EMPLOYER' as Role,
    } as AuthenticatedUser;

    await expect(
      service.getTimeline('application-1', employer),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(getOwnedCompanyId).toHaveBeenCalledWith('employer-1');
  });

  it('returns 404 for a missing application', async () => {
    findUnique.mockResolvedValue(null);

    await expect(service.getTimeline('missing', user)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
