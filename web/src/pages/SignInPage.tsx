import { useState } from 'react';
import type { FormEvent } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { Button, TextField } from '../ui/primitives';
import { QualityPicker } from '../ui/stream';

// Dev sign-in: just a name. replica-backend swaps this for Supabase (email link + Google).
export default function SignInPage() {
  const { me, signIn } = useAuth();
  const [params] = useSearchParams();
  const next = params.get('next') || '/';
  const [name, setName] = useState('');
  const [plan, setPlan] = useState<'free' | 'hd'>('hd');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (me) return <Navigate to={next.startsWith('/') ? next : '/'} replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError('Enter a name so others know who you are');
    setBusy(true);
    setError(null);
    try {
      await signIn(name.trim(), plan);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <form onSubmit={submit} noValidate className="flex w-full max-w-sm flex-col gap-5 rounded-lg border border-border bg-surface p-6">
        <div>
          <h1 className="text-lg text-text">Sign in</h1>
          <p className="mt-1 text-sm text-text-muted">Local test mode: pick a name and a plan. Real accounts come later.</p>
        </div>
        <TextField
          label="Your name"
          autoFocus
          maxLength={40}
          autoComplete="nickname"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={error}
        />
        <QualityPicker
          label="Test as plan"
          value={plan}
          onChange={(v) => setPlan(v as 'free' | 'hd')}
          options={[
            { value: 'free', label: 'Free · 720p30' },
            { value: 'hd', label: 'HD · 1080p60' },
          ]}
        />
        <Button type="submit" loading={busy}>
          Continue
        </Button>
      </form>
    </main>
  );
}
