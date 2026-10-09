import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { getCompanyAnalytics } from '../../api/jobs';
import { Alert, Button, Card, EmptyState, PageHeader, Spinner } from '../../components/ui';
import { STATUS_LABELS } from '../../lib/format';
import type { ApplicationStatus, CompanyAnalytics } from '../../types/api';

const STATUS_COLORS: Record<ApplicationStatus, string> = {
  APPLIED: '#475569',
  REVIEWING: '#0284c7',
  SHORTLISTED: '#7c3aed',
  REJECTED: '#dc2626',
  ACCEPTED: '#059669',
};

const STATUS_ORDER: ApplicationStatus[] = [
  'APPLIED',
  'REVIEWING',
  'SHORTLISTED',
  'REJECTED',
  'ACCEPTED',
];

function formatIsoDate(date: string): string {
  const [, month, day] = date.split('-');
  return `${month}/${day}`;
}

function getVisibleDateIndexes(length: number): Set<number> {
  if (length <= 8) {
    return new Set(Array.from({ length }, (_, index) => index));
  }

  return new Set([0, Math.floor((length - 1) / 2), length - 1]);
}

function truncateTitle(title: string, maxLength = 30): string {
  return title.length > maxLength ? `${title.slice(0, maxLength - 1)}…` : title;
}

function StatusChart({ data }: { data: CompanyAnalytics }) {
  const max = Math.max(...STATUS_ORDER.map((status) => data.byStatus[status]), 1);
  const barX = 132;
  const barWidth = 520;

  return (
    <svg
      aria-label="Applications by status"
      className="h-auto w-full"
      role="img"
      viewBox="0 0 720 250"
    >
      {STATUS_ORDER.map((status, index) => {
        const y = 24 + index * 44;
        const count = data.byStatus[status];
        const width = (count / max) * barWidth;

        return (
          <g key={status}>
            <text className="fill-slate-600 text-[13px]" dominantBaseline="middle" x="0" y={y + 10}>
              {STATUS_LABELS[status]}
            </text>
            <rect
              fill={STATUS_COLORS[status]}
              height="20"
              rx="4"
              width={width}
              x={barX}
              y={y}
            />
            <text
              className="fill-slate-700 text-[13px] font-semibold"
              dominantBaseline="middle"
              x={barX + width + 10}
              y={y + 10}
            >
              {count}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function JobChart({ data }: { data: CompanyAnalytics }) {
  const jobs = [...data.byJob]
    .sort((first, second) => second.applications - first.applications)
    .slice(0, 8);
  const max = Math.max(...jobs.map((job) => job.applications), 1);
  const barX = 230;
  const barWidth = 390;

  if (jobs.length === 0) {
    return <p className="py-8 text-sm text-slate-500">No job data available.</p>;
  }

  return (
    <svg
      aria-label="Applications by job"
      className="h-auto w-full"
      role="img"
      viewBox={`0 0 700 ${jobs.length * 44 + 12}`}
    >
      {jobs.map((job, index) => {
        const y = 12 + index * 44;
        const width = (job.applications / max) * barWidth;

        return (
          <g key={job.jobId}>
            <title>{job.title}</title>
            <text
              className="fill-slate-600 text-[13px]"
              dominantBaseline="middle"
              x="0"
              y={y + 10}
            >
              {truncateTitle(job.title)}
            </text>
            <rect
              className="fill-brand-600"
              height="20"
              rx="4"
              width={width}
              x={barX}
              y={y}
            />
            <text
              className="fill-slate-700 text-[13px] font-semibold"
              dominantBaseline="middle"
              x={barX + width + 10}
              y={y + 10}
            >
              {job.applications}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function DailyChart({ data }: { data: CompanyAnalytics }) {
  const days = useMemo(
    () => [...data.applicationsByDay].sort((first, second) => first.date.localeCompare(second.date)),
    [data.applicationsByDay],
  );

  if (days.length === 0) {
    return <p className="py-8 text-sm text-slate-500">No applications in the last 30 days.</p>;
  }

  const max = Math.max(...days.map((day) => day.count), 1);
  const visibleIndexes = getVisibleDateIndexes(days.length);
  const width = 720;
  const height = 220;
  const chartTop = 20;
  const chartHeight = 150;
  const slotWidth = width / days.length;
  const columnWidth = Math.min(24, slotWidth * 0.62);

  return (
    <svg
      aria-label="Applications per day"
      className="h-auto w-full"
      role="img"
      viewBox={`0 0 ${width} ${height}`}
    >
      <line
        className="stroke-slate-200"
        x1="0"
        x2={width}
        y1={chartTop + chartHeight}
        y2={chartTop + chartHeight}
      />
      {days.map((day, index) => {
        const barHeight = (day.count / max) * chartHeight;
        const x = index * slotWidth + (slotWidth - columnWidth) / 2;
        const y = chartTop + chartHeight - barHeight;

        return (
          <g key={day.date}>
            <rect
              className="fill-brand-600"
              height={barHeight}
              rx="3"
              width={columnWidth}
              x={x}
              y={y}
            >
              <title>{`${day.date}: ${day.count}`}</title>
            </rect>
            {visibleIndexes.has(index) && (
              <text
                className="fill-slate-500 text-[11px]"
                dominantBaseline="middle"
                textAnchor="middle"
                x={x + columnWidth / 2}
                y={chartTop + chartHeight + 22}
              >
                {formatIsoDate(day.date)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export function CompanyAnalyticsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['company-analytics'],
    queryFn: getCompanyAnalytics,
  });

  if (isLoading) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-10">
        <Spinner />
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-10">
        <Alert>{error instanceof Error ? error.message : 'Unable to load analytics.'}</Alert>
      </main>
    );
  }

  if (!data) {
    return null;
  }

  if (data.totals.jobs === 0) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-10">
        <PageHeader title="Analytics" />
        <EmptyState
          action={
            <Link to="/company/jobs/new">
              <Button>Pasang lowongan</Button>
            </Link>
          }
          description="Pasang lowongan untuk mulai memantau lamaran."
          title="No job data yet"
        />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-10">
      <PageHeader
        description="A snapshot of applications across your jobs."
        title="Analytics"
      />

      <section aria-label="Application summary" className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm font-medium text-slate-500">Active jobs</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{data.totals.activeJobs}</p>
        </Card>
        <Card>
          <p className="text-sm font-medium text-slate-500">Total applicants</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{data.totals.applications}</p>
        </Card>
        <Card>
          <p className="text-sm font-medium text-slate-500">Accepted</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{data.byStatus.ACCEPTED}</p>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-5 text-lg font-semibold text-slate-900">Applications by status</h2>
          <StatusChart data={data} />
        </Card>
        <Card>
          <h2 className="mb-5 text-lg font-semibold text-slate-900">Applications by job</h2>
          <JobChart data={data} />
        </Card>
      </section>

      <Card>
        <h2 className="mb-5 text-lg font-semibold text-slate-900">Applications over the last 30 days</h2>
        <DailyChart data={data} />
      </Card>
    </main>
  );
}
