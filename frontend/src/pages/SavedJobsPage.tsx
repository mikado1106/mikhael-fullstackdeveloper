import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import { listSavedJobs } from '../api/savedJobs';
import { JobTypeBadge } from '../components/badges';
import { Pagination } from '../components/Pagination';
import { Alert, Button, Card, EmptyState, PageHeader, Spinner } from '../components/ui';
import { errorMessage } from '../lib/api';
import { formatSalaryRange } from '../lib/format';
import { Link } from 'react-router';

export function SavedJobsPage() {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('page') ?? '1') || 1);
  const query = useQuery({
    queryKey: ['saved-jobs', page],
    queryFn: () => listSavedJobs(page),
    placeholderData: keepPreviousData,
  });

  return (
    <div>
      <PageHeader title="Lowongan tersimpan" description="Daftar lowongan yang Anda simpan." />
      {query.isPending ? <Spinner label="Memuat lowongan tersimpan..." /> : null}
      {query.isError ? (
        <div className="flex flex-col items-start gap-3">
          <Alert>{errorMessage(query.error)}</Alert>
          <Button variant="secondary" onClick={() => void query.refetch()}>Coba lagi</Button>
        </div>
      ) : null}
      {query.data ? query.data.data.length === 0 ? (
        <EmptyState title="Belum ada lowongan tersimpan" description="Simpan lowongan untuk melihatnya di sini." />
      ) : (
        <>
          <div className="flex min-w-0 flex-col gap-3">
            {query.data.data.map((item) => (
              <Card key={item.id} className="flex min-w-0 flex-wrap items-center justify-between gap-4">
                <div className="min-w-0">
                  <Link to={`/jobs/${item.job.id}`} className="break-words font-semibold text-slate-900 hover:underline">{item.job.title}</Link>
                  <p className="break-words text-sm text-slate-600">{item.job.company.name} · {item.job.location}</p>
                  <p className="text-sm text-slate-600">{formatSalaryRange(item.job.salaryMin, item.job.salaryMax)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <JobTypeBadge jobType={item.job.jobType} />
                  {!item.canApply ? <span className="text-sm text-amber-700">Tidak tersedia</span> : null}
                </div>
              </Card>
            ))}
          </div>
          <Pagination meta={query.data.meta} onPageChange={(next) => setParams({ page: String(next) })} />
        </>
      ) : null}
    </div>
  );
}
