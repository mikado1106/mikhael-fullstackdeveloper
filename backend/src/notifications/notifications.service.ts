import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApplicationStatus } from '@prisma/client';
import { Resend } from 'resend';
import type { EnvConfig } from '../config/env.validation';

export interface StatusChangedEmail {
  to: string;
  applicantName: string;
  jobTitle: string;
  companyName: string;
  oldStatus: ApplicationStatus;
  newStatus: ApplicationStatus;
  note?: string | null;
  applicationId: string;
}

export interface MailDriver {
  send(email: { to: string; subject: string; text: string; html: string }): Promise<void>;
}

class ResendMailDriver implements MailDriver {
  private readonly resend: Resend;

  constructor(
    apiKey: string,
    private readonly from: string,
  ) {
    this.resend = new Resend(apiKey);
  }

  async send(email: { to: string; subject: string; text: string; html: string }): Promise<void> {
    const { error } = await this.resend.emails.send({
      from: this.from,
      to: email.to,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });

    // Resend can return an API error without rejecting its promise.
    // Deliberately constant message: provider error objects may carry PII.
    if (error) {
      throw new Error('Email delivery failed');
    }
  }
}

export class LogMailDriver implements MailDriver {
  constructor(
    private readonly logger: Logger,
    private readonly isProduction: boolean,
  ) {}

  send(email: { to: string; subject: string; text: string; html: string }): Promise<void> {
    if (this.isProduction) {
      this.logger.log('Status change email logged (log driver)');
    } else {
      this.logger.log(JSON.stringify(email));
    }
    return Promise.resolve();
  }
}

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  APPLIED: 'Applied',
  REVIEWING: 'Reviewing',
  SHORTLISTED: 'Shortlisted',
  REJECTED: 'Rejected',
  ACCEPTED: 'Accepted',
};

export function stripLineBreaks(value: string): string {
  return value.replace(/[\r\n]/g, '');
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly driver: MailDriver;
  private readonly appUrl: string;

  constructor(config: ConfigService<EnvConfig, true>) {
    const apiKey = config.get('RESEND_API_KEY', { infer: true }).trim();
    const from = config.get('MAIL_FROM', { infer: true });
    const nodeEnv = config.get('NODE_ENV', { infer: true });

    this.appUrl = config.get('APP_URL', { infer: true }).replace(/\/+$/, '');
    this.driver = apiKey
      ? new ResendMailDriver(apiKey, from)
      : new LogMailDriver(this.logger, nodeEnv === 'production');
  }

  async sendStatusChangedEmail(data: StatusChangedEmail): Promise<void> {
    const oldStatus = STATUS_LABELS[data.oldStatus];
    const newStatus = STATUS_LABELS[data.newStatus];
    const subject = stripLineBreaks(
      `[LokerKita] Lamaranmu untuk ${data.jobTitle}: ${newStatus}`,
    ).slice(0, 120);

    const paragraphs = [
      `Hi ${data.applicantName},`,
      `Your application for "${data.jobTitle}" at ${data.companyName} has been updated.`,
      `Status: ${oldStatus} -> ${newStatus}`,
    ];

    if (data.note?.trim()) {
      paragraphs.push(`Reviewer note: ${data.note}`);
    }

    const url = this.appUrl
      ? `${this.appUrl}/applications/${encodeURIComponent(data.applicationId)}`
      : '';

    const textParagraphs = [...paragraphs];
    if (url) {
      textParagraphs.push(`View your application: ${url}`);
    }
    textParagraphs.push('The LokerKita team');

    const htmlParagraphs = paragraphs.map(
      (paragraph) => `<p>${escapeHtml(paragraph).replace(/\r\n|\r|\n/g, '<br>')}</p>`,
    );
    if (url) {
      htmlParagraphs.push(`<p><a href="${escapeHtml(url)}">View your application</a></p>`);
    }
    htmlParagraphs.push('<p>The LokerKita team</p>');

    await this.driver.send({
      to: stripLineBreaks(data.to),
      subject,
      text: textParagraphs.join('\n\n'),
      html: htmlParagraphs.join('\n'),
    });
  }
}
