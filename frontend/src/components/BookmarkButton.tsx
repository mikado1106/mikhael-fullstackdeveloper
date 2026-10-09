import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { lookupSavedJobs, saveJob, unsaveJob } from '../api/savedJobs';
import { useAuth } from '../auth/auth-context';
import { Button } from './ui';

export function BookmarkButton({ jobId, iconOnly = false }: { jobId: string; iconOnly?: boolean }) {
  const { user } = useAuth();
  const client = useQueryClient();
  const savedQuery = useQuery({
    queryKey: ['saved-job-ids', user?.id, jobId],
    queryFn: async () => (await lookupSavedJobs([jobId])).data.length > 0,
    enabled: user?.role === 'JOB_SEEKER',
  });
  const mutation = useMutation({
    mutationFn: (saved: boolean) => saved ? saveJob(jobId) : unsaveJob(jobId),
    onMutate: async (saved) => {
      await client.cancelQueries({ queryKey: ['saved-job-ids', user?.id, jobId] });
      const key = ['saved-job-ids', user?.id, jobId];
      const previous = client.getQueryData<boolean>(key);
      client.setQueryData(key, saved);
      return { previous, key };
    },
    onError: (_error, _saved, context) => {
      if (context?.previous !== undefined) client.setQueryData(context.key, context.previous);
    },
    onSettled: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ['saved-job-ids', user?.id, jobId] }),
        client.invalidateQueries({ queryKey: ['saved-jobs'] }),
      ]);
    },
  });

  if (user?.role === 'COMPANY') return null;
  if (!user) {
    return (
      <Link
        to="/login"
        state={{ from: `/jobs/${jobId}` }}
        aria-label="Masuk untuk menyimpan lowongan"
        className="inline-flex"
      >
        <Button type="button" variant="secondary">Simpan lowongan</Button>
      </Link>
    );
  }

  const saved = savedQuery.data ?? false;
  return (
    <Button
      type="button"
      variant="secondary"
      aria-pressed={saved}
      aria-label={saved ? 'Hapus lowongan dari simpanan' : 'Simpan lowongan'}
      disabled={mutation.isPending || savedQuery.isPending}
      onClick={() => mutation.mutate(!saved)}
      className={iconOnly ? 'px-2' : undefined}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className={iconOnly ? 'h-4 w-4' : 'mr-2 h-4 w-4'} fill={saved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
        <path d="M6 4.75A1.75 1.75 0 0 1 7.75 3h8.5A1.75 1.75 0 0 1 18 4.75V21l-6-3.75L6 21z" />
      </svg>
      {iconOnly ? null : (mutation.isPending ? 'Menyimpan...' : saved ? 'Tersimpan' : 'Simpan')}
      {mutation.isError ? <span className="sr-only"> Gagal. Coba lagi.</span> : null}
    </Button>
  );
}
