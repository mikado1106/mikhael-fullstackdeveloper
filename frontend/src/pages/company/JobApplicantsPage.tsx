import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router';
import { getApplicantCvUrl } from '../../api/cv';
import { listJobApplicants } from '../../api/applications';
import { StatusBadge } from '../../components/badges';
import { Pagination } from '../../components/Pagination';
import { Alert, Button, Card, EmptyState, PageHeader, Spinner } from '../../components/ui';
import { errorMessage } from '../../lib/api';
import { formatDate } from '../../lib/format';
import { useState } from 'react';

export function JobApplicantsPage() {
  const { id = '' } = useParams();
  const [page, setPage] = useState(1);
  const [cvError, setCvError] = useState('');
  const query = useQuery({ queryKey: ['job-applicants', id, page], queryFn: () => listJobApplicants(id, page), enabled: id !== '' });

  const openCv = async (applicationId: string) => {
    setCvError('');
    try {
      const result = await getApplicantCvUrl(applicationId);
      window.location.assign(result.url);
    } catch (cause) {
      setCvError(errorMessage(cause));
    }
  };

  if (query.isPending) return <Spinner label="Memuat pelamar..." />;
  if (query.isError) return <Alert>{errorMessage(query.error)}</Alert>;
  return (
    <div className="min-w-0">
      <PageHeader title={`Pelamar: ${query.data.job.title}`} description="Tinjau lamaran dan CV pelamar." />
      {cvError ? <Alert>{cvError}</Alert> : null}
      {query.data.data.length === 0 ? <EmptyState title="Belum ada pelamar" description="Lamaran untuk lowongan ini akan tampil di sini." /> : (
        <div className="flex min-w-0 flex-col gap-3">
          {query.data.data.map((application) => (
            <Card key={application.id} className="flex min-w-0 flex-wrap items-center justify-between gap-4">
              <div className="min-w-0">
                <Link to={`/applications/${application.id}`} className="break-words font-semibold text-slate-900 hover:underline">{application.applicant.name}</Link>
                <p className="break-words text-sm text-slate-600">{application.applicant.email}</p>
                <p className="text-xs text-slate-500">Melamar {formatDate(application.createdAt)}</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <StatusBadge status={application.status} />
                <Button type="button" variant="secondary" onClick={() => void openCv(application.id)}>Lihat CV terbaru</Button>
                <Link to={`/applications/${application.id}`} className="text-sm font-medium text-brand-600 hover:underline">Tinjau lamaran</Link>
              </div>
            </Card>
          ))}
          <Pagination meta={query.data.meta} onPageChange={setPage} />
        </div>
      )}
    </div>
  );
}
