import { Link } from 'react-router';
import { JobTypeBadge } from './badges';
import { Card, Skeleton } from './ui';
import { formatDate, formatSalaryRange } from '../lib/format';
import type { JobListItem } from '../types/api';

export function JobCard({ job, index }: { job: JobListItem; index?: number }) {
  return (
    <Link
      to={`/jobs/${job.id}`}
      className="block animate-fade-up rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
      style={index === undefined ? undefined : { animationDelay: `${Math.min(index, 5) * 45}ms` }}
    >
      <Card className="flex h-full flex-col gap-3 transition duration-200 hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md">
        <div>
          <h2 className="text-base font-semibold text-slate-900">{job.title}</h2>
          <p className="text-sm text-slate-600">{job.company.name}</p>
        </div>
        <dl className="grid gap-1 text-sm text-slate-600">
          <div className="flex justify-between gap-2">
            <dt className="text-slate-400">Location</dt>
            <dd className="text-right">{job.location}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-slate-400">Salary</dt>
            <dd className="text-right font-medium text-slate-800">{formatSalaryRange(job.salaryMin, job.salaryMax)}</dd>
          </div>
        </dl>
        <div className="mt-auto flex items-center justify-between pt-1">
          <JobTypeBadge jobType={job.jobType} />
          <span className="text-xs text-slate-400">Posted {formatDate(job.createdAt)}</span>
        </div>
      </Card>
    </Link>
  );
}

/** Same height as a real JobCard so the loading grid does not resize. */
export function JobCardSkeleton() {
  return (
    <Card className="flex h-full flex-col gap-3">
      <div>
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="mt-2 h-4 w-1/2" />
      </div>
      <div className="grid gap-1">
        <div className="flex h-5 items-center">
          <Skeleton className="h-4 w-full" />
        </div>
        <div className="flex h-5 items-center">
          <Skeleton className="h-4 w-full" />
        </div>
      </div>
      <div className="mt-auto flex items-center justify-between pt-1">
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-3 w-24" />
      </div>
    </Card>
  );
}
