import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { useAuth } from '../auth/auth-context';
import { roleLabel } from '../lib/format';
import { BrandMark } from './BrandMark';
import { Button } from './ui';

const guestLinks = [{ to: '/jobs', label: 'Jobs' }];

const companyLinks = [
  { to: '/company/jobs', label: 'My jobs' },
  { to: '/company/jobs/new', label: 'Post a job' },
  { to: '/jobs', label: 'Browse jobs' },
];

const seekerLinks = [
  { to: '/jobs', label: 'Jobs' },
  { to: '/applications', label: 'My applications' },
];

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const links = !user ? guestLinks : user.role === 'COMPANY' ? companyLinks : seekerLinks;

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link
            to="/"
            className="rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
          >
            <BrandMark />
          </Link>
          <nav
            aria-label="Main"
            className="order-last flex basis-full gap-1 overflow-x-auto sm:order-none sm:basis-auto"
          >
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end
                className={({ isActive }) =>
                  `whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                    isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100'
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
          {user ? (
            <div className="ml-auto flex items-center gap-3">
              <div className="min-w-0 text-right text-sm leading-tight">
                <p className="truncate font-medium text-slate-800">{user.name}</p>
                <p className="hidden text-xs text-slate-500 sm:block">
                  {user.role === 'COMPANY' && user.company ? user.company.name : roleLabel(user.role)}
                </p>
              </div>
              <Button variant="secondary" onClick={handleLogout}>
                Log out
              </Button>
            </div>
          ) : (
            <div className="ml-auto flex items-center gap-2">
              <Link to="/login">
                <Button variant="secondary">Log in</Button>
              </Link>
              <Link to="/register">
                <Button>Create account</Button>
              </Link>
            </div>
          )}
        </div>
      </header>
      {/* Key on pathname only: replay on route change, not on filter or page updates. */}
      <main key={location.pathname} className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 animate-fade-up">
        <Outlet />
      </main>
      <footer className="border-t border-slate-200 py-4 text-center text-xs text-slate-400">
        IndoKerja.id technical assessment
      </footer>
    </div>
  );
}
