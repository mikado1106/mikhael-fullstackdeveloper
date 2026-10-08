import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApplicationStatus } from '@prisma/client';
import type { EnvConfig } from '../config/env.validation';
import {
  escapeHtml,
  LogMailDriver,
  NotificationsService,
  STATUS_LABELS,
  stripLineBreaks,
} from './notifications.service';

describe('notification helpers', () => {
  it('escapes all five HTML entities', () => {
    expect(escapeHtml('&<>"\'')).toBe('&amp;&lt;&gt;&quot;&#39;');
  });

  it.each([
    ['CR', 'first\rsecond'],
    ['LF', 'first\nsecond'],
    ['CRLF', 'first\r\nsecond'],
  ])('removes %s line breaks', (_label, value) => {
    expect(stripLineBreaks(value)).toBe('firstsecond');
  });

  it('humanizes all application statuses', () => {
    expect(STATUS_LABELS).toEqual({
      APPLIED: 'Applied',
      REVIEWING: 'Reviewing',
      SHORTLISTED: 'Shortlisted',
      REJECTED: 'Rejected',
      ACCEPTED: 'Accepted',
    });
  });
});

describe('NotificationsService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('strips subject CR/LF before capping the subject at 120 characters', async () => {
    const values: Record<string, string> = {
      RESEND_API_KEY: '',
      MAIL_FROM: 'noreply@lokerkita.id',
      APP_URL: '',
      NODE_ENV: 'test',
    };
    const config = {
      get: (key: string) => values[key],
    } as unknown as ConfigService<EnvConfig, true>;
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const service = new NotificationsService(config);
    const jobTitle = `Backend\rEngineer\nLead\r\n${'x'.repeat(150)}`;

    await service.sendStatusChangedEmail({
      to: 'applicant@example.com',
      applicantName: 'Applicant',
      jobTitle,
      companyName: 'Example Company',
      oldStatus: ApplicationStatus.APPLIED,
      newStatus: ApplicationStatus.REVIEWING,
      applicationId: 'application-1',
    });

    expect(log).toHaveBeenCalledTimes(1);
    const email = JSON.parse(log.mock.calls[0][0] as string) as {
      subject: string;
    };
    const expectedSubject = `[LokerKita] Lamaranmu untuk ${jobTitle}: Reviewing`
      .replace(/[\r\n]/g, '')
      .slice(0, 120);

    expect(email.subject).toBe(expectedSubject);
    expect(email.subject).not.toMatch(/[\r\n]/);
    expect(email.subject).toHaveLength(120);
  });
});

describe('LogMailDriver', () => {
  const email = {
    to: 'private-applicant@example.com',
    subject: 'Private status change subject',
    text: 'Private plain text body',
    html: '<p>Private HTML body</p>',
  };

  it('does not log email addresses, subjects, or bodies in production', async () => {
    const logger = { log: jest.fn() };
    const driver = new LogMailDriver(logger as unknown as Logger, true);

    await driver.send(email);

    expect(logger.log).toHaveBeenCalledTimes(1);
    expect(logger.log).toHaveBeenCalledWith('Status change email logged (log driver)');
    const message = (logger.log.mock.calls as string[][])[0][0];
    for (const value of Object.values(email)) {
      expect(message).not.toContain(value);
    }
  });

  it('logs email content outside production for local debugging', async () => {
    const logger = { log: jest.fn() };
    const driver = new LogMailDriver(logger as unknown as Logger, false);

    await driver.send(email);

    expect(logger.log).toHaveBeenCalledTimes(1);
    expect(logger.log).toHaveBeenCalledWith(JSON.stringify(email));
    expect(JSON.parse((logger.log.mock.calls as string[][])[0][0])).toEqual(email);
  });
});
