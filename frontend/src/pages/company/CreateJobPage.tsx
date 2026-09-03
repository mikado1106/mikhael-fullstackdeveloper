import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type SubmitEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { createJob } from '../../api/jobs';
import { Alert, Button, Card, Field, Input, PageHeader, Select, Textarea } from '../../components/ui';
import { errorMessage } from '../../lib/api';
import { JOB_TYPE_LABELS, JOB_TYPES } from '../../lib/format';
import type { JobType } from '../../types/api';

export function CreateJobPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [jobType, setJobType] = useState<JobType>('FULL_TIME');
  const [salaryMin, setSalaryMin] = useState('');
  const [salaryMax, setSalaryMax] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: createJob,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['company-jobs'] });
      navigate('/company/jobs', { state: { flash: 'Job published. It is now visible to job seekers.' } });
    },
  });

  const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const min = Number(salaryMin);
    const max = Number(salaryMax);
    if (max < min) {
      setValidationError('Maximum salary must be greater than or equal to the minimum salary.');
      return;
    }
    setValidationError(null);
    mutation.mutate({
      title: title.trim(),
      description: description.trim(),
      location: location.trim(),
      jobType,
      salaryMin: min,
      salaryMax: max,
    });
  };

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Post a job" description="Fill in the vacancy details. It becomes visible to job seekers immediately." />

      <Card>
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {validationError ? <Alert>{validationError}</Alert> : null}
          {mutation.isError ? <Alert>{errorMessage(mutation.error)}</Alert> : null}

          <Field label="Job title" htmlFor="title">
            <Input id="title" required minLength={3} maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} />
          </Field>

          <Field label="Description" htmlFor="description" hint="At least 10 characters">
            <Textarea
              id="description"
              required
              minLength={10}
              maxLength={5000}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="min-h-40"
            />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Location" htmlFor="location">
              <Input id="location" required minLength={2} value={location} onChange={(event) => setLocation(event.target.value)} />
            </Field>
            <Field label="Job type" htmlFor="jobType">
              <Select id="jobType" value={jobType} onChange={(event) => setJobType(event.target.value as JobType)}>
                {JOB_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {JOB_TYPE_LABELS[type]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Minimum salary (IDR / month)" htmlFor="salaryMin">
              <Input
                id="salaryMin"
                type="number"
                inputMode="numeric"
                required
                min={0}
                step={100000}
                value={salaryMin}
                onChange={(event) => setSalaryMin(event.target.value)}
              />
            </Field>
            <Field label="Maximum salary (IDR / month)" htmlFor="salaryMax">
              <Input
                id="salaryMax"
                type="number"
                inputMode="numeric"
                required
                min={0}
                step={100000}
                value={salaryMax}
                onChange={(event) => setSalaryMax(event.target.value)}
              />
            </Field>
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Publishing...' : 'Publish job'}
            </Button>
            <Link to="/company/jobs">
              <Button variant="secondary">Cancel</Button>
            </Link>
          </div>
        </form>
      </Card>
    </div>
  );
}
