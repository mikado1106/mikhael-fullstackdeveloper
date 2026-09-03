import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router';
import { listJobApplicants } from '../../api/applications';
import { StatusBadge } from '../../components/badges';
import { Alert, Card, EmptyState, PageHeader, Spinner } from '../../components/ui';
import { errorMessage } from '../../lib/api';
import { formatDate } from '../../lib/format';

export function JobApplicantsPage() {
  const { id = '' } = useParams();
  const applicantsQuery = useQuery({
    queryKey: ['job-applicants', id],
    queryFn: () => listJobApplicants(id),
    enabled: id !== '',
  });

  if (applicantsQuery.isPending) {
    return <Spinner label="Loading applicants..." />;
  }
  if (applicantsQuery.isError) {
    return <Alert>{errorMessage(applicantsQuery.error)}</Alert>;
  }

  const { job, data: applicants } = applicantsQuery.data;

  return (
    <div>
      <Link to="/company/jobs" className="text-sm text-brand-600 hover:underline">
        &larr; Back to my jobs
      </Link>
      <div className="mt-4">
        <PageHeader
          title={`Applicants for ${job.title}`}
          description={`${applicants.length} ${applicants.length === 1 ? 'candidate' : 'candidates'} so far.`}
        />
      </div>

      {applicants.length === 0 ? (
        <EmptyState title="No applications yet" description="Candidates will appear here as soon as they apply." />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Candidate</th>
                <th className="px-4 py-3 font-semibold">Applied</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Cover letter</th>
                <th className="px-4 py-3 font-semibold">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {applicants.map((application) => (
                <tr key={application.id} className="align-top">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{application.applicant.name}</p>
                    <p className="text-xs text-slate-500">{application.applicant.email}</p>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDate(application.createdAt)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={application.status} />
                  </td>
                  <td className="max-w-xs px-4 py-3 text-slate-600">
                    {application.coverLetter ? (
                      <span className="line-clamp-2">{application.coverLetter}</span>
                    ) : (
                      <span className="italic text-slate-400">None</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <Link to={`/applications/${application.id}`} className="font-medium text-brand-600 hover:underline">
                      Review
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
