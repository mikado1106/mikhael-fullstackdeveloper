import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { getMyCv, getMyCvDownloadUrl, issueCvUploadUrl, finalizeCvUpload } from '../api/cv';
import { Alert, Button, Card, Spinner } from './ui';
import { errorMessage } from '../lib/api';

export function CvManager() {
  const client = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const xhr = useRef<XMLHttpRequest | null>(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const cvQuery = useQuery({ queryKey: ['my-cv'], queryFn: getMyCv });

  const upload = async (file?: File) => {
    if (!file) return;
    setError('');
    setStatus('');
    if (file.type !== 'application/pdf' || file.size < 1 || file.size > 5_000_000) {
      setError('Pilih file PDF dengan ukuran 1 hingga 5.000.000 byte.');
      return;
    }
    setBusy(true);
    setProgress(0);
    try {
      const attempt = await issueCvUploadUrl({ fileName: file.name, sizeBytes: file.size, mimeType: 'application/pdf' });
      setStatus('Mengunggah CV...');
      await new Promise<void>((resolve, reject) => {
        const request = new XMLHttpRequest();
        xhr.current = request;
        request.open(attempt.upload.method, attempt.upload.url);
        Object.entries(attempt.upload.headers).forEach(([key, value]) => request.setRequestHeader(key, value));
        request.upload.onprogress = (event) => {
          if (event.lengthComputable) setProgress(Math.round((event.loaded / event.total) * 100));
        };
        request.onload = () => request.status >= 200 && request.status < 300 ? resolve() : reject(new Error(`Upload gagal (${request.status}).`));
        request.onerror = () => reject(new Error('Koneksi upload gagal.'));
        request.onabort = () => reject(new Error('Upload dibatalkan.'));
        request.send(file);
      });
      setStatus('Memverifikasi CV...');
      await finalizeCvUpload(attempt.attemptId);
      await client.invalidateQueries({ queryKey: ['my-cv'] });
      setStatus('CV berhasil diperbarui. CV ini juga digunakan untuk lamaran yang sudah dikirim.');
    } catch (cause) {
      setError(errorMessage(cause));
      setStatus('');
    } finally {
      xhr.current = null;
      setBusy(false);
    }
  };

  const download = async () => {
    try {
      const result = await getMyCvDownloadUrl();
      window.location.assign(result.url);
    } catch (cause) {
      setError(errorMessage(cause));
    }
  };

  return (
    <Card className="flex min-w-0 flex-col gap-4">
      <div><h2 className="text-base font-semibold text-slate-900">CV saya</h2><p className="mt-1 text-sm text-slate-600">CV baru akan digunakan juga untuk lamaran yang sudah dikirim.</p></div>
      {cvQuery.isPending ? <Spinner label="Memuat metadata CV..." /> : null}
      {cvQuery.isError ? <Alert>{errorMessage(cvQuery.error)}</Alert> : null}
      {cvQuery.data?.cv ? (
        <div className="min-w-0">
          <p className="break-words text-sm font-medium text-slate-800">{cvQuery.data.cv.fileName}</p>
          <p className="text-xs text-slate-500">{cvQuery.data.cv.sizeBytes.toLocaleString()} byte · Diperbarui {new Date(cvQuery.data.cv.updatedAt).toLocaleString()}</p>
          <Button type="button" variant="secondary" className="mt-3" onClick={() => void download()}>Unduh CV</Button>
        </div>
      ) : cvQuery.data ? <p className="text-sm text-slate-600">Belum ada CV aktif.</p> : null}
      <input
        ref={fileInput}
        type="file"
        accept="application/pdf,.pdf"
        className="block max-w-full text-sm"
        aria-label="Pilih file CV PDF"
        disabled={busy}
        onChange={(event) => { void upload(event.target.files?.[0]); event.currentTarget.value = ''; }}
      />
      {busy ? (
        <div>
          <p className="text-sm" aria-live="polite">{status}</p>
          {status.startsWith('Mengunggah') ? (
            <progress className="mt-2 w-full" max={100} value={progress} aria-label={`Progres upload ${progress}%`} />
          ) : null}
          {status.startsWith('Mengunggah') ? <span className="text-xs text-slate-500">{progress}%</span> : null}
          <Button type="button" variant="secondary" className="mt-2" onClick={() => xhr.current?.abort()}>Batalkan upload</Button>
        </div>
      ) : null}
      {status && !busy ? <p role="status" className="text-sm text-green-700">{status}</p> : null}
      {error ? <div role="alert" className="flex flex-col items-start gap-2"><Alert>{error}</Alert><Button variant="secondary" onClick={() => fileInput.current?.click()}>Pilih file lain atau coba lagi</Button></div> : null}
    </Card>
  );
}
