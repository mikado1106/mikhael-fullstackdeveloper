import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { applyToJob } from '../api/applications';
import { getJob } from '../api/jobs';
import { useAuth } from '../auth/auth-context';
import { JobTypeBadge, StatusBadge } from '../components/badges';
import { Alert, Button, Card, Field, Spinner, Textarea } from '../components/ui';
import { errorMessage } from '../lib/api';
import { formatDate, formatSalaryRange } from '../lib/format';
import type { JobDetail } from '../types/api';

export function JobDetailPage() {
  const { id = '' } = useParams();
  const jobQuery = useQuery({ queryKey: ['job', id], queryFn: () => getJob(id), enabled: id !== '' });

  if (jobQuery.isPending) {
    return <Spinner label="Loading job..." />;
  }
  if (jobQuery.isError) {
    return <Alert>{errorMessage(jobQuery.error)}</Alert>;
  }

  const job = jobQuery.data;

  return (
    <div>
      <Link to="/jobs" className="text-sm text-brand-600 hover:underline">
        &larr; Back to jobs
      </Link>

      <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="flex flex-col gap-6">
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">{job.title}</h1>
                <p className="mt-1 text-slate-600">
                  {job.company.name} &middot; {job.location}
                </p>
              </div>
              <JobTypeBadge jobType={job.jobType} />
            </div>
            <dl className="mt-5 grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-3">
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-400">Salary (monthly)</dt>
                <dd className="mt-1 text-sm font-medium text-slate-800">{formatSalaryRange(job.salaryMin, job.salaryMax)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-400">Posted</dt>
                <dd className="mt-1 text-sm text-slate-800">{formatDate(job.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-400">Applicants</dt>
                <dd className="mt-1 text-sm text-slate-800">{job.applicationsCount}</dd>
              </div>
            </dl>
          </Card>

          <Card>
            <h2 className="text-base font-semibold text-slate-900">About the role</h2>
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-700">{job.description}</p>
          </Card>

          {job.company.description ? (
            <Card>
              <h2 className="text-base font-semibold text-slate-900">About {job.company.name}</h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-700">{job.company.description}</p>
            </Card>
          ) : null}
        </div>

        <aside>
          <ApplyPanel job={job} />
        </aside>
      </div>
    </div>
  );
}

function ApplyPanel({ job }: { job: JobDetail }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [coverLetter, setCoverLetter] = useState('');

  const applyMutation = useMutation({
    mutationFn: () => applyToJob(job.id, coverLetter.trim() || undefined),
    onSuccess: async () => {
      setShowForm(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['job', job.id] }),
        queryClient.invalidateQueries({ queryKey: ['my-applications'] }),
      ]);
    },
  });

  if (!user) {
    return (
      <Card className="flex flex-col gap-3 animate-fade-in">
        <p className="text-sm font-semibold text-slate-900">Interested in this role?</p>
        <p className="text-sm text-slate-600">Log in or create a free job seeker account to apply.</p>
        <Link to="/login" state={{ from: `/jobs/${job.id}` }}>
          <Button className="w-full">Log in to apply</Button>
        </Link>
        <Link
          to="/register"
          state={{ from: `/jobs/${job.id}` }}
          className="text-center text-sm font-medium text-brand-700 hover:underline"
        >
          Create an account
        </Link>
      </Card>
    );
  }

  if (user.role === 'COMPANY') {
    const ownsJob = user.company?.id === job.companyId;
    return (
      <Card className="flex flex-col gap-3 animate-fade-in">
        <p className="text-sm text-slate-600">
          {ownsJob ? 'This is one of your postings.' : 'Only job seekers can apply to jobs.'}
        </p>
        {ownsJob ? (
          <Link to={`/company/jobs/${job.id}/applicants`} className="text-sm font-medium text-brand-600 hover:underline">
            View applicants ({job.applicationsCount})
          </Link>
        ) : null}
      </Card>
    );
  }

  if (job.myApplication) {
    return (
      <Card className="flex flex-col gap-3 animate-fade-in">
        <p className="text-sm font-semibold text-slate-900">You applied on {formatDate(job.myApplication.createdAt)}</p>
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <span>Current status:</span>
          <StatusBadge status={job.myApplication.status} />
        </div>
        <Link to={`/applications/${job.myApplication.id}`} className="text-sm font-medium text-brand-600 hover:underline">
          View application history
        </Link>
      </Card>
    );
  }

  if (!job.isActive) {
    return (
      <Card>
        <p className="text-sm text-slate-600">This job is no longer accepting applications.</p>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-4">
      {applyMutation.isError ? <Alert>{errorMessage(applyMutation.error)}</Alert> : null}
      {showForm ? (
        <form
          className="flex flex-col gap-4 animate-fade-up"
          onSubmit={(event) => {
            event.preventDefault();
            applyMutation.mutate();
          }}
        >
          <Field label="Cover letter" htmlFor="coverLetter" hint="Optional, up to 2000 characters">
            <Textarea
              id="coverLetter"
              maxLength={2000}
              value={coverLetter}
              onChange={(event) => setCoverLetter(event.target.value)}
              placeholder="Tell the company why you are a good fit"
            />
          </Field>
          <div className="flex gap-2">
            <Button type="submit" disabled={applyMutation.isPending}>
              {applyMutation.isPending ? 'Submitting...' : 'Submit application'}
            </Button>
            <Button variant="secondary" onClick={() => setShowForm(false)} disabled={applyMutation.isPending}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <>
          <p className="text-sm text-slate-600">Send your application to {job.company.name}.</p>
          <Button onClick={() => setShowForm(true)}>Apply for this job</Button>
        </>
      )}
    </Card>
  );
}
