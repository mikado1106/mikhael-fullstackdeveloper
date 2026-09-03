import type { ApplicationStatus, JobType, Role } from '../types/api';

export const JOB_TYPE_LABELS: Record<JobType, string> = {
  FULL_TIME: 'Full-time',
  PART_TIME: 'Part-time',
  CONTRACT: 'Contract',
  INTERNSHIP: 'Internship',
  FREELANCE: 'Freelance',
};

export const JOB_TYPES = Object.keys(JOB_TYPE_LABELS) as JobType[];

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  APPLIED: 'Applied',
  REVIEWING: 'Reviewing',
  SHORTLISTED: 'Shortlisted',
  REJECTED: 'Rejected',
  ACCEPTED: 'Accepted',
};

export const APPLICATION_STATUSES = Object.keys(STATUS_LABELS) as ApplicationStatus[];

const FINAL_STATUSES: readonly ApplicationStatus[] = ['REJECTED', 'ACCEPTED'];

export function isFinalStatus(status: ApplicationStatus): boolean {
  return FINAL_STATUSES.includes(status);
}

const idrFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

export function formatIDR(amount: number): string {
  return idrFormatter.format(amount);
}

export function formatSalaryRange(min: number, max: number): string {
  return min === max ? formatIDR(min) : `${formatIDR(min)} - ${formatIDR(max)}`;
}

const dateFormatter = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' });
const dateTimeFormatter = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

export function formatDate(iso: string): string {
  return dateFormatter.format(new Date(iso));
}

export function formatDateTime(iso: string): string {
  return dateTimeFormatter.format(new Date(iso));
}

export function homePathFor(role: Role): string {
  return role === 'COMPANY' ? '/company/jobs' : '/jobs';
}

export function roleLabel(role: Role): string {
  return role === 'COMPANY' ? 'Company' : 'Job seeker';
}
