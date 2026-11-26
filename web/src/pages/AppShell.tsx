import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { LogOut, Radio } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { Skeleton } from '../ui/primitives';

export function RequireAuth() {
  const { me, loading } = useAuth();
  const loc = useLocation();
  if (loading)
    return (
      <div className="p-8" aria-busy>
        <Skeleton className="h-8 w-48" />
      </div>
    );
  if (!me) return <Navigate to={`/signin?next=${encodeURIComponent(loc.pathname)}`} replace />;
  return <Outlet />;
}

export default function AppShell() {
  const { me, signOut } = useAuth();
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-[var(--layout-header)] shrink-0 items-center gap-3 border-b border-border bg-surface px-4">
        <Link to="/" className="flex items-center gap-2 font-semibold text-text">
          <Radio aria-hidden className="size-5" />
          Streamroom
        </Link>
        {me && (
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="hidden text-text-muted sm:inline">
              {me.display_name} · <span className="text-text">{me.plan.name}</span>
            </span>
            <button
              type="button"
              onClick={signOut}
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-text-muted hover:bg-surface-raised hover:text-text"
            >
              <LogOut aria-hidden className="size-4" />
              Sign out
            </button>
          </div>
        )}
      </header>
      <div className="flex min-h-0 flex-1 flex-col">
        <Outlet />
      </div>
    </div>
  );
}
