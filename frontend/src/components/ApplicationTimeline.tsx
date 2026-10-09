import { useQuery } from '@tanstack/react-query';
import { getApplicationTimeline } from '../api/applications';
import { Alert, Button, Card, Spinner } from './ui';
import { errorMessage } from '../lib/api';
import { StatusBadge } from './badges';

export function ApplicationTimeline({ applicationId }: { applicationId: string }) {
  const query = useQuery({
    queryKey: ['application-timeline', applicationId],
    queryFn: () => getApplicationTimeline(applicationId),
  });

  if (query.isPending) return <Spinner label="Memuat riwayat status..." />;
  if (query.isError) {
    return <div className="flex flex-col items-start gap-3"><Alert>{errorMessage(query.error)}</Alert><Button variant="secondary" onClick={() => void query.refetch()}>Coba lagi</Button></div>;
  }

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'zona waktu lokal';
  return (
    <Card>
      <h2 className="text-base font-semibold text-slate-900">Riwayat status</h2>
      <p className="mt-1 text-xs text-slate-500">Waktu ditampilkan dalam zona waktu {timeZone}.</p>
      <div className="mt-4">
        <p className="text-sm text-slate-700">Status saat ini</p>
        <div className="mt-1"><StatusBadge status={query.data.currentStatus} /></div>
      </div>
      {query.data.history.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">Riwayat perubahan belum tersedia.</p>
      ) : (
        <ol className="mt-4 flex flex-col gap-4">
          {query.data.history.map((entry) => (
            <li key={entry.id} className="flex min-w-0 gap-3">
              <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-brand-600" aria-hidden="true" />
              <div className="min-w-0">
                <StatusBadge status={entry.status} />
                <time className="mt-1 block break-words text-xs text-slate-500" dateTime={entry.occurredAt}>
                  {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short', timeZone }).format(new Date(entry.occurredAt))}
                </time>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
