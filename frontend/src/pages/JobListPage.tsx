import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState, type SubmitEvent } from 'react';
import { useSearchParams } from 'react-router';
import { listJobs } from '../api/jobs';
import { JobCard, JobCardSkeleton } from '../components/JobCard';
import { Pagination } from '../components/Pagination';
import { Alert, Button, EmptyState, Input, PageHeader, Select } from '../components/ui';
import { errorMessage } from '../lib/api';
import { JOB_TYPE_LABELS, JOB_TYPES } from '../lib/format';
import type { JobType } from '../types/api';

const PAGE_SIZE = 20;

function isJobType(value: string): value is JobType {
  return (JOB_TYPES as string[]).includes(value);
}

function validInteger(value: string): string {
  return /^\d+$/.test(value) ? value : '';
}

export function JobListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);
  const search = searchParams.get('search') ?? '';
  const location = searchParams.get('location') ?? '';
  const jobTypeParam = searchParams.get('jobType') ?? '';
  const jobType = isJobType(jobTypeParam) ? jobTypeParam : undefined;
  const salaryMin = validInteger(searchParams.get('salaryMin') ?? '');
  const salaryMax = validInteger(searchParams.get('salaryMax') ?? '');

  const [searchInput, setSearchInput] = useState(search);
  const [locationInput, setLocationInput] = useState(location);
  const [jobTypeInput, setJobTypeInput] = useState(jobTypeParam);
  const [salaryMinInput, setSalaryMinInput] = useState(salaryMin);
  const [salaryMaxInput, setSalaryMaxInput] = useState(salaryMax);
  const [filterError, setFilterError] = useState('');
  const sequence = useRef(0);

  useEffect(() => setSearchInput(search), [search]);
  useEffect(() => setLocationInput(location), [location]);
  useEffect(() => setJobTypeInput(jobTypeParam), [jobTypeParam]);
  useEffect(() => setSalaryMinInput(salaryMin), [salaryMin]);
  useEffect(() => setSalaryMaxInput(salaryMax), [salaryMax]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const nextSearch = searchInput.trim();
      if (nextSearch !== search) {
        const params = new URLSearchParams(searchParams);
        nextSearch ? params.set('search', nextSearch) : params.delete('search');
        params.set('page', '1');
        setSearchParams(params);
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput, search, searchParams, setSearchParams]);

  const requestSequence = ++sequence.current;
  const jobsQuery = useQuery({
    queryKey: ['jobs', { page, search, location, jobType, salaryMin, salaryMax }],
    queryFn: async () => {
      const result = await listJobs({
        page,
        limit: PAGE_SIZE,
        search: search || undefined,
        location: location || undefined,
        jobType,
        salaryMin: salaryMin ? Number(salaryMin) : undefined,
        salaryMax: salaryMax ? Number(salaryMax) : undefined,
      });
      if (requestSequence !== sequence.current) return result;
      return result;
    },
    placeholderData: keepPreviousData,
  });

  const updateParams = (updates: Record<string, string>, resetPage = false) => {
    const params = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(updates)) {
      value ? params.set(key, value) : params.delete(key);
    }
    if (resetPage) params.set('page', '1');
    setSearchParams(params);
  };

  const handleFilter = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const min = salaryMinInput.trim();
    const max = salaryMaxInput.trim();
    const validSalary = (value: string) => value === '' || (/^\d+$/.test(value) && Number(value) <= 2147483647);
    if (!validSalary(min) || !validSalary(max)) {
      setFilterError('Gaji harus berupa bilangan bulat nonnegatif yang valid.');
      return;
    }
    if (min && max && Number(min) > Number(max)) {
      setFilterError('Gaji minimum tidak boleh melebihi gaji maksimum.');
      return;
    }
    if (searchInput.trim().length > 100 || locationInput.trim().length > 100) {
      setFilterError('Kata kunci dan lokasi maksimal 100 karakter.');
      return;
    }
    setFilterError('');
    updateParams({
      search: searchInput.trim(),
      location: locationInput.trim(),
      jobType: isJobType(jobTypeInput) ? jobTypeInput : '',
      salaryMin: min,
      salaryMax: max,
    }, true);
  };

  const handleReset = () => {
    setSearchInput('');
    setLocationInput('');
    setJobTypeInput('');
    setSalaryMinInput('');
    setSalaryMaxInput('');
    setFilterError('');
    setSearchParams(searchParams.get('limit') ? { limit: searchParams.get('limit')! } : {});
  };

  return (
    <div>
      <PageHeader title="Lowongan kerja" description="Temukan peluang kerja yang sesuai di seluruh Indonesia." />

      <form onSubmit={handleFilter} className="mb-6 grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Input
          type="search"
          placeholder="Cari jabatan, deskripsi, atau perusahaan"
          aria-label="Kata kunci"
          maxLength={100}
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
        />
        <Input
          placeholder="Lokasi"
          aria-label="Lokasi"
          maxLength={100}
          value={locationInput}
          onChange={(event) => setLocationInput(event.target.value)}
        />
        <Select aria-label="Jenis pekerjaan" value={jobTypeInput} onChange={(event) => setJobTypeInput(event.target.value)}>
          <option value="">Semua jenis pekerjaan</option>
          {JOB_TYPES.map((type) => <option key={type} value={type}>{JOB_TYPE_LABELS[type]}</option>)}
        </Select>
        <Input
          type="number"
          min="0"
          max="2147483647"
          step="1"
          aria-label="Gaji minimum bulanan dalam IDR"
          placeholder="cth: 8000000"
          value={salaryMinInput}
          onChange={(event) => setSalaryMinInput(event.target.value)}
        />
        <Input
          type="number"
          min="0"
          max="2147483647"
          step="1"
          aria-label="Gaji maksimum bulanan dalam IDR"
          placeholder="cth: 8000000"
          value={salaryMaxInput}
          onChange={(event) => setSalaryMaxInput(event.target.value)}
        />
        <div className="flex gap-2">
          <Button type="submit">Terapkan filter</Button>
          <Button type="button" variant="secondary" onClick={handleReset}>Reset</Button>
        </div>
        {filterError ? <p className="text-sm text-red-700" role="alert">{filterError}</p> : null}
      </form>

      {jobsQuery.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => <JobCardSkeleton key={index} />)}
        </div>
      ) : null}
      {jobsQuery.isError ? (
        <div className="flex flex-col items-start gap-3">
          <Alert>{errorMessage(jobsQuery.error)}</Alert>
          <Button variant="secondary" onClick={() => void jobsQuery.refetch()}>Coba lagi</Button>
        </div>
      ) : null}

      {jobsQuery.data ? (
        jobsQuery.data.data.length === 0 ? (
          jobsQuery.data.meta.total > 0 && page > 1 ? (
            <div className="flex flex-col items-start gap-3">
              <Alert>Halaman ini melewati hasil yang tersedia.</Alert>
              <Button onClick={() => updateParams({ page: '1' })}>Kembali ke halaman pertama</Button>
            </div>
          ) : (
            <EmptyState title="Lowongan tidak ditemukan" description="Coba ubah kata kunci atau hapus sebagian filter." />
          )
        ) : (
          <>
            <div className={`grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3 ${jobsQuery.isFetching ? 'opacity-70' : ''}`}>
              {jobsQuery.data.data.map((job, index) => <JobCard key={job.id} job={job} index={index} />)}
            </div>
            <Pagination
              meta={jobsQuery.data.meta}
              onPageChange={(next) => updateParams({ page: String(next) })}
            />
          </>
        )
      ) : null}
    </div>
  );
}
