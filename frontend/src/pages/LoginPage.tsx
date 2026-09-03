import { useMutation } from '@tanstack/react-query';
import { useState, type SubmitEvent } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../auth/auth-context';
import { AuthShell } from '../components/AuthShell';
import { Alert, Button, Field, Input } from '../components/ui';
import { errorMessage } from '../lib/api';

const DEMO_PASSWORD = 'password123';
const DEMO_ACCOUNTS = [
  { label: 'Company', email: 'company@indokerja.id' },
  { label: 'Job seeker', email: 'seeker@indokerja.id' },
];

export function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // PublicOnly redirects after login, so no navigate() here.
  const mutation = useMutation({ mutationFn: login });

  const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    mutation.mutate({ email, password });
  };

  const fillDemo = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword(DEMO_PASSWORD);
  };

  return (
    <AuthShell title="Sign in" subtitle="Log in as a job seeker or a company">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {mutation.isError ? <Alert>{errorMessage(mutation.error)}</Alert> : null}
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
        <Field label="Password" htmlFor="password">
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Signing in...' : 'Sign in'}
        </Button>
      </form>

      <div className="mt-5 rounded-lg bg-slate-50 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Demo accounts</p>
        <p className="mt-1 text-xs text-slate-500">Password for both: {DEMO_PASSWORD}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {DEMO_ACCOUNTS.map((account) => (
            <Button key={account.email} variant="secondary" onClick={() => fillDemo(account.email)}>
              Use {account.label.toLowerCase()} account
            </Button>
          ))}
        </div>
      </div>

      <p className="mt-5 text-center text-sm text-slate-600">
        No account yet?{' '}
        <Link to="/register" className="font-medium text-brand-600 hover:underline">
          Create one
        </Link>
      </p>
    </AuthShell>
  );
}
