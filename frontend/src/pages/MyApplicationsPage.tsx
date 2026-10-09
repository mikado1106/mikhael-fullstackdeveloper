import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { listMyApplications } from '../api/applications';
import { JobTypeBadge, StatusBadge } from '../components/badges';
import { Alert, Button, Card, EmptyState, PageHeader, Spinner } from '../components/ui';
import { Pagination } from '../components/Pagination';
import { errorMessage } from '../lib/api';
import { formatDate, formatSalaryRange } from '../lib/format';

export function MyApplicationsPage() {
  const [page, setPage] = useState(1);
  const applicationsQuery = useQuery({
    queryKey: ['my-applications', page],
    queryFn: () => listMyApplications(page),
  });

  return (
    <div>
      <PageHeader title="Lamaran saya" description="Semua lowongan yang Anda lamar, beserta statusnya." />

      {applicationsQuery.isPending ? <Spinner label="Memuat lamaran..." /> : null}
      {applicationsQuery.isError ? <Alert>{errorMessage(applicationsQuery.error)}</Alert> : null}

      {applicationsQuery.data ? (
        applicationsQuery.data.meta.total === 0 ? (
          <EmptyState
            title="Belum ada lamaran"
            description="Jelajahi lowongan dan kirim lamaran pertama Anda."
            action={
              <Link to="/jobs">
                <Button>Jelajahi lowongan</Button>
              </Link>
            }
          />
        ) : (
          <>
            <div className="flex flex-col gap-3">
              {applicationsQuery.data.data.map((application) => (
              <Card key={application.id} className="flex flex-wrap items-center justify-between gap-4">
                <div className="min-w-0">
                  <Link to={`/jobs/${application.job.id}`} className="text-base font-semibold text-slate-900 hover:underline">
                    {application.job.title}
                  </Link>
                  <p className="text-sm text-slate-600">
                    {application.job.company.name} &middot; {application.job.location}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {formatSalaryRange(application.job.salaryMin, application.job.salaryMax)} &middot; Melamar pada{' '}
                    {formatDate(application.createdAt)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <JobTypeBadge jobType={application.job.jobType} />
                  <StatusBadge status={application.status} />
                  <Link to={`/applications/${application.id}`} className="text-sm font-medium text-brand-600 hover:underline">
                    Lihat riwayat
                  </Link>
                </div>
              </Card>
            ))}
            </div>
            <Pagination meta={applicationsQuery.data.meta} onPageChange={setPage} />
          </>
        )
      ) : null}
    </div>
  );
}
