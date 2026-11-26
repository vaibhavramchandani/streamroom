import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, Plus, Users } from 'lucide-react';
import { api } from '../lib/api';
import type { RoomInfo } from '../lib/api';
import { Button, Skeleton, TextField, Toast } from '../ui/primitives';

export default function HomePage() {
  const nav = useNavigate();
  const [rooms, setRooms] = useState<RoomInfo[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    setLoadError(null);
    api.rooms().then(setRooms).catch((e) => setLoadError(e.message));
  };
  useEffect(load, []);

  async function create(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setCreateError('Give the room a name');
    setBusy(true);
    setCreateError(null);
    try {
      const room = await api.createRoom(name.trim());
      nav(`/r/${room.id}`);
    } catch (err) {
      setCreateError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 p-4 sm:p-8">
      <section className="rounded-lg border border-border bg-surface p-5">
        <h1 className="text-lg text-text">Start a room</h1>
        <p className="mt-1 text-sm text-text-muted">Make a room, send the link, and share your screen with anyone who joins.</p>
        <form onSubmit={create} noValidate className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start">
          <TextField
            className="flex-1"
            label="Room name"
            placeholder="Friday game night"
            maxLength={60}
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={createError}
          />
          <Button type="submit" loading={busy} icon={<Plus className="size-4" />} className="sm:mt-7">
            Create room
          </Button>
        </form>
      </section>

      <section aria-labelledby="your-rooms" className="flex flex-col gap-3">
        <h2 id="your-rooms" className="text-lg text-text">
          Your rooms
        </h2>
        {loadError && (
          <div className="flex flex-col items-start gap-3">
            <Toast tone="danger" title="Couldn’t load your rooms">
              {loadError}
            </Toast>
            <Button variant="secondary" size="sm" onClick={load}>
              Try again
            </Button>
          </div>
        )}
        {!rooms && !loadError && (
          <div className="flex flex-col gap-2" aria-busy aria-label="Loading rooms">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        )}
        {rooms?.length === 0 && (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-text-muted">
            No rooms yet. Create one above, or open an invite link a friend sent you.
          </p>
        )}
        {rooms && rooms.length > 0 && (
          <ul className="flex flex-col gap-2">
            {rooms.map((r) => (
              <li key={r.id}>
                <Link
                  to={`/r/${r.id}`}
                  className="flex items-center gap-3 rounded-lg border border-border bg-surface p-4 hover:border-border-input"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-text">{r.name}</span>
                    <span className="mt-0.5 flex items-center gap-1 text-xs text-text-muted">
                      <Users aria-hidden className="size-3.5" />
                      {r.members.length} {r.members.length === 1 ? 'member' : 'members'} · {r.my_role}
                    </span>
                  </span>
                  <ChevronRight aria-hidden className="size-4 text-text-muted" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
