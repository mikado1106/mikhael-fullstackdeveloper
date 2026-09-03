import { Link } from 'react-router';
import { Button } from '../components/ui';

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-5xl font-bold text-slate-300">404</p>
      <p className="text-lg font-semibold text-slate-800">This page does not exist.</p>
      <Link to="/">
        <Button variant="secondary">Go to the home page</Button>
      </Link>
    </div>
  );
}
