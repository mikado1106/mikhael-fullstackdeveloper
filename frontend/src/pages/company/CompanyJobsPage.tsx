import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { listMyJobs } from '../../api/jobs';
import { JobTypeBadge } from '../../components/badges';
import { Alert, Button, Card, EmptyState, PageHeader, Spinner } from '../../components/ui';
import { errorMessage } from '../../lib/api';
import { formatDate, formatSalaryRange } from '../../lib/format';
import type { CompanyJob } from '../../types/api';

type LocationState = { flash?: string } | null;

function summarize(jobs: CompanyJob[]) {
  const activeJobs = jobs.filter((job) => job.isActive).length;
  const totalApplicants = jobs.reduce((sum, job) => sum + job.applicationsCount, 0);
  const awaitingApplicants = jobs.filter((job) => job.applicationsCount === 0).length;
  return { activeJobs, totalApplicants, awaitingApplicants };
}

export function CompanyJobsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const jobsQuery = useQuery({ queryKey: ['company-jobs'], queryFn: listMyJobs });
  const [flash] = useState<string | undefined>(() => (location.state as LocationState)?.flash);

  useEffect(() => {
    if ((location.state as LocationState)?.flash) {
      navigate(location.pathname + location.search, { replace: true, state: null });
    }
  }, [location, navigate]);

  const summary = jobsQuery.data && jobsQuery.data.length > 0 ? summarize(jobsQuery.data) : null;

  const postButton = (
    <Link to="/company/jobs/new">
      <Button>Post a job</Button>
    </Link>
  );

  return (
    <div>
      <PageHeader title="My jobs" description="Vacancies posted by your company and their applicants." action={postButton} />

      {flash ? (
        <div className="mb-6">
          <Alert kind="success">{flash}</Alert>
        </div>
      ) : null}

      {jobsQuery.isPending ? <Spinner label="Loading your jobs..." /> : null}
      {jobsQuery.isError ? <Alert>{errorMessage(jobsQuery.error)}</Alert> : null}

      {summary ? (
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          {[
            { label: 'Active jobs', value: summary.activeJobs },
            { label: 'Total applicants', value: summary.totalApplicants },
            { label: 'Awaiting first applicant', value: summary.awaitingApplicants },
          ].map((tile, index) => (
            <Card
              key={tile.label}
              className="animate-fade-up"
              style={{ animationDelay: `${Math.min(index, 5) * 45}ms` }}
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{tile.label}</p>
              <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">{tile.value}</p>
            </Card>
          ))}
        </div>
      ) : null}

      {jobsQuery.data ? (
        jobsQuery.data.length === 0 ? (
          <EmptyState
            title="No jobs posted yet"
            description="Create your first vacancy to start receiving applications."
            action={postButton}
          />
        ) : (
          <div className="flex flex-col gap-3">
            {jobsQuery.data.map((job, index) => (
              <Card
                key={job.id}
                className="flex animate-fade-up flex-wrap items-center justify-between gap-4"
                style={{ animationDelay: `${Math.min(index, 5) * 45}ms` }}
              >
                <div className="min-w-0">
                  <Link to={`/jobs/${job.id}`} className="text-base font-semibold text-slate-900 hover:underline">
                    {job.title}
                  </Link>
                  <p className="text-sm text-slate-600">
                    {job.location} &middot; {formatSalaryRange(job.salaryMin, job.salaryMax)}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">Posted {formatDate(job.createdAt)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <JobTypeBadge jobType={job.jobType} />
                  <Link to={`/company/jobs/${job.id}/applicants`}>
                    <Button variant="secondary">
                      Applicants
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                        {job.applicationsCount}
                      </span>
                    </Button>
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        )
      ) : null}
    </div>
  );
}
