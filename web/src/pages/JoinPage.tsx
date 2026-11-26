import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { api } from '../lib/api';
import { Toast } from '../ui/primitives';

export default function JoinPage() {
  const { code = '' } = useParams();
  const nav = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .joinRoom(code)
      .then((room) => !cancelled && nav(`/r/${room.id}`, { replace: true }))
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [code, nav]);

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-4">
      {error ? (
        <>
          <Toast tone="danger" title="Couldn’t join">
            {error}
          </Toast>
          <Link to="/" className="text-sm text-focus underline">
            Go to your rooms
          </Link>
        </>
      ) : (
        <p role="status" className="flex items-center gap-2 text-text-muted">
          <Loader2 aria-hidden className="size-4 animate-spin" /> Joining room…
        </p>
      )}
    </main>
  );
}
