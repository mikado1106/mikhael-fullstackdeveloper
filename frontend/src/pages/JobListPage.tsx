import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState, type SubmitEvent } from 'react';
import { useSearchParams } from 'react-router';
import { listJobs } from '../api/jobs';
import { JobCard, JobCardSkeleton } from '../components/JobCard';
import { Pagination } from '../components/Pagination';
import { Alert, Button, EmptyState, Input, PageHeader, Select } from '../components/ui';
import { errorMessage } from '../lib/api';
import { JOB_TYPE_LABELS, JOB_TYPES } from '../lib/format';
import type { JobType } from '../types/api';

const PAGE_SIZE = 9;

function isJobType(value: string): value is JobType {
  return (JOB_TYPES as string[]).includes(value);
}

export function JobListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);
  const search = searchParams.get('search') ?? '';
  const jobTypeParam = searchParams.get('jobType') ?? '';
  const jobType = isJobType(jobTypeParam) ? jobTypeParam : undefined;

  const [searchInput, setSearchInput] = useState(search);
  const [jobTypeInput, setJobTypeInput] = useState(jobTypeParam);

  const jobsQuery = useQuery({
    queryKey: ['jobs', { page, search, jobType }],
    queryFn: () => listJobs({ page, limit: PAGE_SIZE, search: search || undefined, jobType }),
    placeholderData: keepPreviousData,
  });

  const updateParams = (next: Record<string, string>) => {
    const params: Record<string, string> = {};
    for (const [key, value] of Object.entries(next)) {
      if (value) {
        params[key] = value;
      }
    }
    setSearchParams(params);
  };

  const handleFilter = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    updateParams({ search: searchInput.trim(), jobType: jobTypeInput, page: '1' });
  };

  const handleReset = () => {
    setSearchInput('');
    setJobTypeInput('');
    setSearchParams({});
  };

  return (
    <div>
      <PageHeader title="Job openings" description="Browse active vacancies from companies across Indonesia." />

      <form onSubmit={handleFilter} className="mb-6 grid gap-3 sm:grid-cols-[1fr_200px_auto_auto]">
        <Input
          type="search"
          placeholder="Search by job title or company"
          aria-label="Search jobs"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
        />
        <Select aria-label="Job type" value={jobTypeInput} onChange={(event) => setJobTypeInput(event.target.value)}>
          <option value="">All job types</option>
          {JOB_TYPES.map((type) => (
            <option key={type} value={type}>
              {JOB_TYPE_LABELS[type]}
            </option>
          ))}
        </Select>
        <Button type="submit">Search</Button>
        <Button variant="secondary" onClick={handleReset}>
          Reset
        </Button>
      </form>

      {jobsQuery.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: PAGE_SIZE }, (_, index) => (
            <JobCardSkeleton key={index} />
          ))}
        </div>
      ) : null}
      {jobsQuery.isError ? <Alert>{errorMessage(jobsQuery.error)}</Alert> : null}

      {jobsQuery.data ? (
        jobsQuery.data.data.length === 0 ? (
          <EmptyState title="No jobs match your search" description="Try a different keyword or clear the filters." />
        ) : (
          <>
            <div className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-3 ${jobsQuery.isFetching ? 'opacity-70' : ''}`}>
              {jobsQuery.data.data.map((job, index) => (
                <JobCard key={job.id} job={job} index={index} />
              ))}
            </div>
            <Pagination meta={jobsQuery.data.meta} onPageChange={(next) => updateParams({ search, jobType: jobTypeParam, page: String(next) })} />
          </>
        )
      ) : null}
    </div>
  );
}
