import { useQuery } from '@tanstack/react-query';
import { useState, type SubmitEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { listJobs } from '../api/jobs';
import { JobCard, JobCardSkeleton } from '../components/JobCard';
import { Alert, Button, Card, EmptyState, Input } from '../components/ui';
import { useAuth } from '../auth/auth-context';
import { errorMessage } from '../lib/api';
import { homePathFor } from '../lib/format';

const LATEST_LIMIT = 6;

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m16.5 16.5 4 4" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path d="M21 3 3 10l7 3 3 7z" />
      <path d="M21 3 10 13" />
    </svg>
  );
}

function ClipboardIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <rect x="5" y="5" width="14" height="16" rx="2" />
      <path d="M9 3h6v4H9z" />
      <path d="M9 12h6M9 16h4" />
    </svg>
  );
}

const STEPS = [
  {
    title: 'Browse jobs',
    description: 'Filter by title, company or job type. No account needed.',
    icon: <SearchIcon />,
  },
  {
    title: 'Apply in one click',
    description: 'Add an optional cover letter and send your application in seconds.',
    icon: <SendIcon />,
  },
  {
    title: 'Track every step',
    description: 'See your status move from Applied to Accepted, with a full history.',
    icon: <ClipboardIcon />,
  },
];

export function HomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const jobsQuery = useQuery({
    queryKey: ['jobs', { page: 1, limit: LATEST_LIMIT }],
    queryFn: () => listJobs({ page: 1, limit: LATEST_LIMIT }),
  });

  if (user) {
    return <Navigate to={homePathFor(user.role)} replace />;
  }

  const handleSearch = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const term = search.trim();
    navigate(term ? { pathname: '/jobs', search: `?search=${encodeURIComponent(term)}` } : { pathname: '/jobs' });
  };

  const total = jobsQuery.data?.meta.total;

  return (
    <div>
      <section className="animate-fade-up rounded-2xl bg-brand-600 px-6 py-10 text-white sm:px-10 sm:py-14">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-100">Job board</p>
        <h1 className="mt-3 max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">Find your next role in Indonesia.</h1>
        <p className="mt-3 max-w-xl text-sm text-brand-100 sm:text-base">
          Browse open positions from companies across the country. Create a free account to apply and track every step
          of your application.
        </p>

        <form role="search" onSubmit={handleSearch} className="mt-6 flex max-w-xl flex-col gap-2 sm:flex-row">
          <Input
            type="search"
            className="bg-white"
            aria-label="Search jobs"
            placeholder="Job title or company"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <Button type="submit" variant="secondary" className="shrink-0">
            Search jobs
          </Button>
        </form>

        {total !== undefined ? (
          <p className="mt-4 animate-fade-in text-sm text-brand-100">
            {total} open {total === 1 ? 'position' : 'positions'} right now
          </p>
        ) : null}
      </section>

      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">Latest openings</h2>
          <Link to="/jobs" className="text-sm font-medium text-brand-700 hover:underline">
            Browse all jobs
          </Link>
        </div>

        {jobsQuery.isPending ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: LATEST_LIMIT }, (_, index) => (
              <JobCardSkeleton key={index} />
            ))}
          </div>
        ) : null}
        {jobsQuery.isError ? <Alert>{errorMessage(jobsQuery.error)}</Alert> : null}

        {jobsQuery.data ? (
          jobsQuery.data.data.length === 0 ? (
            <div className="mt-4">
              <EmptyState title="No openings yet" description="New vacancies show up here as soon as companies post them." />
            </div>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {jobsQuery.data.data.map((job, index) => (
                <JobCard key={job.id} job={job} index={index} />
              ))}
            </div>
          )
        ) : null}
      </section>

      <section className="mt-10 grid gap-4 sm:grid-cols-3">
        {STEPS.map((step, index) => (
          <Card
            key={step.title}
            className="flex animate-fade-up flex-col gap-3"
            style={{ animationDelay: `${index * 45}ms` }}
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
              {step.icon}
            </span>
            <div>
              <p className="text-base font-semibold text-slate-900">{step.title}</p>
              <p className="mt-1 text-sm text-slate-600">{step.description}</p>
            </div>
          </Card>
        ))}
      </section>

      <section className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6">
        <div>
          <p className="text-base font-semibold text-slate-900">Hiring?</p>
          <p className="text-sm text-slate-600">Post a vacancy and review candidates in one place.</p>
        </div>
        <Link to="/register">
          <Button variant="secondary">Create a company account</Button>
        </Link>
      </section>
    </div>
  );
}
