import { useMutation } from '@tanstack/react-query';
import { useState, type SubmitEvent } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../auth/auth-context';
import { AuthShell } from '../components/AuthShell';
import { Alert, Button, Field, Input } from '../components/ui';
import { errorMessage } from '../lib/api';
import type { RegisterRequest, Role } from '../types/api';

export function RegisterPage() {
  const { register } = useAuth();
  const [role, setRole] = useState<Role>('JOB_SEEKER');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [companyLocation, setCompanyLocation] = useState('');

  const mutation = useMutation({ mutationFn: register });

  const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const dto: RegisterRequest = { name, email, password, role };
    if (role === 'COMPANY') {
      dto.companyName = companyName;
      if (companyLocation.trim()) {
        dto.companyLocation = companyLocation.trim();
      }
    }
    mutation.mutate(dto);
  };

  return (
    <AuthShell title="Create an account" subtitle="Join as a job seeker or post jobs as a company">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {mutation.isError ? <Alert>{errorMessage(mutation.error)}</Alert> : null}

        <fieldset className="flex flex-col gap-1.5">
          <legend className="text-sm font-medium text-slate-700">I am a</legend>
          <div className="grid grid-cols-2 gap-2">
            {(['JOB_SEEKER', 'COMPANY'] as Role[]).map((option) => (
              <label
                key={option}
                className={`flex cursor-pointer items-center justify-center rounded-lg border px-3 py-2 text-sm font-medium ${
                  role === option
                    ? 'border-brand-600 bg-brand-50 text-brand-700'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="role"
                  value={option}
                  checked={role === option}
                  onChange={() => setRole(option)}
                  className="sr-only"
                />
                {option === 'COMPANY' ? 'Company' : 'Job seeker'}
              </label>
            ))}
          </div>
        </fieldset>

        <Field label={role === 'COMPANY' ? 'Contact person name' : 'Full name'} htmlFor="name">
          <Input id="name" required minLength={2} value={name} onChange={(event) => setName(event.target.value)} />
        </Field>

        {role === 'COMPANY' ? (
          <>
            <Field label="Company name" htmlFor="companyName">
              <Input
                id="companyName"
                required
                minLength={2}
                value={companyName}
                onChange={(event) => setCompanyName(event.target.value)}
              />
            </Field>
            <Field label="Company location" htmlFor="companyLocation" hint="Optional">
              <Input
                id="companyLocation"
                value={companyLocation}
                onChange={(event) => setCompanyLocation(event.target.value)}
              />
            </Field>
          </>
        ) : null}

        <Field label="Email" htmlFor="email">
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>
        <Field label="Password" htmlFor="password" hint="At least 8 characters">
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>

        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Creating account...' : 'Create account'}
        </Button>
      </form>

      <p className="mt-5 text-center text-sm text-slate-600">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-brand-600 hover:underline">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
