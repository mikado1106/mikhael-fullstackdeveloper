import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type SubmitEvent } from 'react';
import { Link, useParams } from 'react-router';
import { getApplication, updateApplicationStatus } from '../api/applications';
import { useAuth } from '../auth/auth-context';
import { JobTypeBadge, StatusBadge } from '../components/badges';
import { StatusStepper } from '../components/StatusStepper';
import { ApplicationTimeline } from '../components/ApplicationTimeline';
import { Alert, Button, Card, Field, Input, Select, Spinner } from '../components/ui';
import { errorMessage } from '../lib/api';
import { APPLICATION_STATUSES, formatDate, formatSalaryRange, isFinalStatus, STATUS_LABELS } from '../lib/format';
import type { ApplicationDetail, ApplicationStatus } from '../types/api';

export function ApplicationDetailPage() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const applicationQuery = useQuery({ queryKey: ['application', id], queryFn: () => getApplication(id), enabled: id !== '' });

  if (applicationQuery.isPending) return <Spinner label="Memuat lamaran..." />;
  if (applicationQuery.isError) return <Alert>{errorMessage(applicationQuery.error)}</Alert>;

  const application = applicationQuery.data;
  const isCompany = user?.role === 'COMPANY';
  const backLink = isCompany
    ? { to: `/company/jobs/${application.job.id}/applicants`, label: 'Kembali ke pelamar' }
    : { to: '/applications', label: 'Kembali ke lamaran saya' };

  return (
    <div className="min-w-0">
      <Link to={backLink.to} className="text-sm text-brand-600 hover:underline">← {backLink.label}</Link>
      <div className="mt-4 grid min-w-0 gap-6 lg:grid-cols-[1fr_340px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-wide text-slate-400">Lamaran untuk</p>
                <Link to={`/jobs/${application.job.id}`} className="break-words text-xl font-bold text-slate-900 hover:underline">{application.job.title}</Link>
                <p className="mt-1 break-words text-sm text-slate-600">{application.job.company.name} · {application.job.location} · {formatSalaryRange(application.job.salaryMin, application.job.salaryMax)}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2"><JobTypeBadge jobType={application.job.jobType} /><StatusBadge status={application.status} /></div>
            </div>
            <div className="mt-5"><StatusStepper status={application.status} /></div>
            <dl className="mt-5 grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2">
              <div><dt className="text-xs uppercase tracking-wide text-slate-400">Pelamar</dt><dd className="mt-1 break-words text-sm text-slate-800">{application.applicant.name}{isCompany ? <span className="block text-xs text-slate-500">{application.applicant.email}</span> : null}</dd></div>
              <div><dt className="text-xs uppercase tracking-wide text-slate-400">Tanggal melamar</dt><dd className="mt-1 text-sm text-slate-800">{formatDate(application.createdAt)}</dd></div>
            </dl>
          </Card>
          <Card>
            <h2 className="text-base font-semibold text-slate-900">Surat lamaran</h2>
            <p className="mt-3 whitespace-pre-line break-words text-sm leading-relaxed text-slate-700">{application.coverLetter || 'Tidak ada surat lamaran.'}</p>
          </Card>
          {!isCompany ? <ApplicationTimeline applicationId={application.id} /> : (
            <Card><h2 className="text-base font-semibold text-slate-900">Riwayat status</h2>
              <ol className="mt-4 flex flex-col gap-3">{application.history.map((entry) => <li key={entry.id} className="flex flex-wrap items-center gap-2"><StatusBadge status={entry.toStatus} /><span className="text-xs text-slate-500">{formatDate(entry.createdAt)}</span></li>)}</ol>
            </Card>
          )}
        </div>
        <aside>{isCompany ? <StatusUpdatePanel application={application} /> : <SeekerInfoPanel application={application} />}</aside>
      </div>
    </div>
  );
}

function SeekerInfoPanel({ application }: { application: ApplicationDetail }) {
  const guidance = application.status === 'REJECTED'
    ? 'Lamaran ini berstatus ditolak. Jangan berkecil hati — Anda bisa melamar lowongan lain yang sesuai.'
    : application.status === 'ACCEPTED'
      ? 'Selamat! Perusahaan akan menghubungi Anda untuk langkah selanjutnya.'
      : isFinalStatus(application.status)
        ? `Lamaran ini berstatus ${STATUS_LABELS[application.status].toLowerCase()}.`
        : 'Perusahaan akan meninjau lamaran Anda. Perubahan status tampil di riwayat.';

  return <Card className="flex flex-col gap-2"><p className="text-sm font-semibold text-slate-900">Langkah berikutnya</p><p className="text-sm text-slate-600">{guidance}</p></Card>;
}

const NEXT_STATUS: Partial<Record<ApplicationStatus, ApplicationStatus>> = { APPLIED: 'REVIEWING', REVIEWING: 'SHORTLISTED', SHORTLISTED: 'ACCEPTED' };
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
        queryClient.invalidateQueries({ queryKey: ['application-timeline', application.id] }),
        queryClient.invalidateQueries({ queryKey: ['job-applicants', application.job.id] }),
        queryClient.invalidateQueries({ queryKey: ['company-jobs'] }),
      ]);
    },
  });
  const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => { event.preventDefault(); mutation.mutate(); };

  return (
    <Card className="flex flex-col gap-4">
      <div><p className="text-sm font-semibold text-slate-900">Perbarui status</p><p className="mt-1 text-xs text-slate-500">Perubahan akan dicatat dalam riwayat.</p></div>
      {locked ? <Alert kind="info">Lamaran ini sudah memiliki keputusan akhir.</Alert> : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {mutation.isError ? <Alert>{errorMessage(mutation.error)}</Alert> : null}
          <Field label="Status baru" htmlFor="status"><Select id="status" value={status} onChange={(event) => setStatus(event.target.value as ApplicationStatus)}>{options.map((option) => <option key={option} value={option}>{STATUS_LABELS[option]}</option>)}</Select></Field>
          <Field label="Catatan" htmlFor="note" hint="Opsional"><Input id="note" maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} /></Field>
          <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Menyimpan...' : 'Simpan status'}</Button>
        </form>
      )}
    </Card>
  );
}
