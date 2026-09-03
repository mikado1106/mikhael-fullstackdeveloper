import { JOB_TYPE_LABELS, STATUS_LABELS } from '../lib/format';
import type { ApplicationStatus, JobType } from '../types/api';

const statusStyles: Record<ApplicationStatus, string> = {
  APPLIED: 'bg-slate-100 text-slate-700',
  REVIEWING: 'bg-sky-100 text-sky-800',
  SHORTLISTED: 'bg-violet-100 text-violet-800',
  REJECTED: 'bg-red-100 text-red-800',
  ACCEPTED: 'bg-emerald-100 text-emerald-800',
};

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusStyles[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

export function JobTypeBadge({ jobType }: { jobType: JobType }) {
  return (
    <span className="inline-flex rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700">
      {JOB_TYPE_LABELS[jobType]}
    </span>
  );
}
