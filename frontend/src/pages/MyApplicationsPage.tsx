import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { listMyApplications } from '../api/applications';
import { JobTypeBadge, StatusBadge } from '../components/badges';
import { Alert, Button, Card, EmptyState, PageHeader, Spinner } from '../components/ui';
import { errorMessage } from '../lib/api';
import { formatDate, formatSalaryRange } from '../lib/format';

export function MyApplicationsPage() {
  const applicationsQuery = useQuery({ queryKey: ['my-applications'], queryFn: listMyApplications });

  return (
    <div>
      <PageHeader title="My applications" description="Every job you applied to, with its current status." />

      {applicationsQuery.isPending ? <Spinner label="Loading applications..." /> : null}
      {applicationsQuery.isError ? <Alert>{errorMessage(applicationsQuery.error)}</Alert> : null}

      {applicationsQuery.data ? (
        applicationsQuery.data.length === 0 ? (
          <EmptyState
            title="No applications yet"
            description="Browse the openings and send your first application."
            action={
              <Link to="/jobs">
                <Button>Browse jobs</Button>
              </Link>
            }
          />
        ) : (
          <div className="flex flex-col gap-3">
            {applicationsQuery.data.map((application) => (
              <Card key={application.id} className="flex flex-wrap items-center justify-between gap-4">
                <div className="min-w-0">
                  <Link to={`/jobs/${application.job.id}`} className="text-base font-semibold text-slate-900 hover:underline">
                    {application.job.title}
                  </Link>
                  <p className="text-sm text-slate-600">
                    {application.job.company.name} &middot; {application.job.location}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {formatSalaryRange(application.job.salaryMin, application.job.salaryMax)} &middot; Applied{' '}
                    {formatDate(application.createdAt)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <JobTypeBadge jobType={application.job.jobType} />
                  <StatusBadge status={application.status} />
                  <Link to={`/applications/${application.id}`} className="text-sm font-medium text-brand-600 hover:underline">
                    View history
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
