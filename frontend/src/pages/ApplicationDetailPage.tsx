import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type SubmitEvent } from 'react';
import { Link, useParams } from 'react-router';
import { getApplication, updateApplicationStatus } from '../api/applications';
import { useAuth } from '../auth/auth-context';
import { JobTypeBadge, StatusBadge } from '../components/badges';
import { StatusStepper } from '../components/StatusStepper';
import { Alert, Button, Card, Field, Input, Select, Spinner } from '../components/ui';
import { errorMessage } from '../lib/api';
import {
  APPLICATION_STATUSES,
  formatDate,
  formatDateTime,
  formatSalaryRange,
  isFinalStatus,
  STATUS_LABELS,
} from '../lib/format';
import type { ApplicationDetail, ApplicationStatus } from '../types/api';

export function ApplicationDetailPage() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const applicationQuery = useQuery({
    queryKey: ['application', id],
    queryFn: () => getApplication(id),
    enabled: id !== '',
  });

  if (applicationQuery.isPending) {
    return <Spinner label="Loading application..." />;
  }
  if (applicationQuery.isError) {
    return <Alert>{errorMessage(applicationQuery.error)}</Alert>;
  }

  const application = applicationQuery.data;
  const isCompany = user?.role === 'COMPANY';
  const backLink = isCompany
    ? { to: `/company/jobs/${application.job.id}/applicants`, label: 'Back to applicants' }
    : { to: '/applications', label: 'Back to my applications' };

  return (
    <div>
      <Link to={backLink.to} className="text-sm text-brand-600 hover:underline">
        &larr; {backLink.label}
      </Link>

      <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="flex flex-col gap-6">
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Application for</p>
                <Link to={`/jobs/${application.job.id}`} className="text-xl font-bold text-slate-900 hover:underline">
                  {application.job.title}
                </Link>
                <p className="mt-1 text-sm text-slate-600">
                  {application.job.company.name} &middot; {application.job.location} &middot;{' '}
                  {formatSalaryRange(application.job.salaryMin, application.job.salaryMax)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <JobTypeBadge jobType={application.job.jobType} />
                <StatusBadge status={application.status} />
              </div>
            </div>

            <div className="mt-5">
              <StatusStepper status={application.status} />
            </div>

            <dl className="mt-5 grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-400">Applicant</dt>
                <dd className="mt-1 text-sm text-slate-800">
                  {application.applicant.name}
                  <span className="block text-xs text-slate-500">{application.applicant.email}</span>
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-400">Applied on</dt>
                <dd className="mt-1 text-sm text-slate-800">{formatDate(application.createdAt)}</dd>
              </div>
            </dl>
          </Card>

          <Card>
            <h2 className="text-base font-semibold text-slate-900">Cover letter</h2>
            {application.coverLetter ? (
              <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-700">{application.coverLetter}</p>
            ) : (
              <p className="mt-3 text-sm italic text-slate-400">No cover letter was provided.</p>
            )}
          </Card>

          <Card>
            <h2 className="text-base font-semibold text-slate-900">Status history</h2>
            <ol className="mt-4 flex flex-col gap-4">
              {application.history.map((entry, index) => (
                <li
                  key={entry.id}
                  className="flex gap-3 animate-fade-up"
                  style={{ animationDelay: `${Math.min(index, 5) * 45}ms` }}
                >
                  <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-brand-600" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-sm text-slate-800">
                      {entry.fromStatus ? (
                        <>
                          <StatusBadge status={entry.fromStatus} />
                          <span className="text-slate-400">&rarr;</span>
                        </>
                      ) : null}
                      <StatusBadge status={entry.toStatus} />
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {formatDateTime(entry.createdAt)} &middot; by {entry.changedBy.name}
                    </p>
                    {entry.note ? <p className="mt-1 text-sm text-slate-600">{entry.note}</p> : null}
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <aside>{isCompany ? <StatusUpdatePanel application={application} /> : <SeekerInfoPanel application={application} />}</aside>
      </div>
    </div>
  );
}

function SeekerInfoPanel({ application }: { application: ApplicationDetail }) {
  return (
    <Card className="flex flex-col gap-2">
      <p className="text-sm font-semibold text-slate-900">What happens next?</p>
      <p className="text-sm text-slate-600">
        {isFinalStatus(application.status)
          ? `This application is ${STATUS_LABELS[application.status].toLowerCase()}. The company has made a final decision.`
          : 'The company reviews applications in stages. You will see every status change here.'}
      </p>
    </Card>
  );
}

/** The natural next step in the pipeline, used as the default selection. */
const NEXT_STATUS: Partial<Record<ApplicationStatus, ApplicationStatus>> = {
  APPLIED: 'REVIEWING',
  REVIEWING: 'SHORTLISTED',
  SHORTLISTED: 'ACCEPTED',
};

function defaultNextStatus(current: ApplicationStatus): ApplicationStatus {
  return NEXT_STATUS[current] ?? APPLICATION_STATUSES.find((status) => status !== current) ?? 'REVIEWING';
}

function StatusUpdatePanel({ application }: { application: ApplicationDetail }) {
  const queryClient = useQueryClient();
  const options = APPLICATION_STATUSES.filter((status) => status !== application.status);
  const [status, setStatus] = useState<ApplicationStatus>(() => defaultNextStatus(application.status));
  const [note, setNote] = useState('');
  const locked = isFinalStatus(application.status);

  const mutation = useMutation({
    mutationFn: () => updateApplicationStatus(application.id, { status, note: note.trim() || undefined }),
    onSuccess: async (updated) => {
      setNote('');
      setStatus(defaultNextStatus(updated.status));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['application', application.id] }),
        queryClient.invalidateQueries({ queryKey: ['job-applicants', application.job.id] }),
        queryClient.invalidateQueries({ queryKey: ['company-jobs'] }),
      ]);
    },
  });

  const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    mutation.mutate();
  };

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <p className="text-sm font-semibold text-slate-900">Update status</p>
        <p className="mt-1 text-xs text-slate-500">
          Every change is recorded in the history with your name and an optional note.
        </p>
      </div>

      {locked ? (
        <Alert kind="info">
          This application is {STATUS_LABELS[application.status].toLowerCase()} and can no longer be changed.
        </Alert>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {mutation.isError ? <Alert>{errorMessage(mutation.error)}</Alert> : null}
          {mutation.isSuccess ? <Alert kind="success">Status updated.</Alert> : null}
          <Field label="New status" htmlFor="status">
            <Select id="status" value={status} onChange={(event) => setStatus(event.target.value as ApplicationStatus)}>
              {options.map((option) => (
                <option key={option} value={option}>
                  {STATUS_LABELS[option]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Note" htmlFor="note" hint="Optional, e.g. interview schedule">
            <Input id="note" maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} />
          </Field>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Saving...' : 'Save status'}
          </Button>
        </form>
      )}
    </Card>
  );
}
