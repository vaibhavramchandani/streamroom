import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { api } from '../lib/api';
import type { Member, RoomInfo } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Button, Skeleton, Toast } from '../ui/primitives';

// S08: who can stream in this room.
export default function RoomSettingsPage() {
  const { roomId = '' } = useParams();
  const { me } = useAuth();
  const nav = useNavigate();
  const [info, setInfo] = useState<RoomInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    api.room(roomId).then(setInfo).catch((e) => setError(e.message));
  }, [roomId]);

  async function update(m: Member, patch: Partial<Pick<Member, 'can_stream' | 'role'>>) {
    setPending(m.user_id);
    setError(null);
    const before = info;
    // Show the change straight away; put it back if the server says no.
    setInfo((cur) =>
      cur && { ...cur, members: cur.members.map((x) => (x.user_id === m.user_id ? { ...x, ...patch } : x)) },
    );
    try {
      setInfo(await api.patchMember(roomId, m.user_id, patch));
    } catch (e) {
      setInfo(before);
      setError((e as Error).message);
    } finally {
      setPending(null);
    }
  }

  async function remove(m: Member) {
    setPending(m.user_id);
    try {
      await api.removeMember(roomId, m.user_id);
      if (m.user_id === me?.id) return nav('/');
      setInfo(await api.room(roomId));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(null);
    }
  }

  const canManage = info && info.my_role !== 'member';

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-5 p-4 sm:p-8">
      <Link to={`/r/${roomId}`} className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text">
        <ArrowLeft aria-hidden className="size-4" /> Back to the room
      </Link>
      <h1 className="text-lg text-text">{info ? `${info.name}: members` : 'Members'}</h1>
      {error && <Toast tone="danger" title="That didn’t work">{error}</Toast>}
      {!info && !error && <Skeleton className="h-40" />}
      {info && !canManage && (
        <p className="text-sm text-text-muted">Only the room owner or an admin can change who streams.</p>
      )}
      {info && (
        <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
          {info.members.map((m) => {
            const locked = m.role === 'owner' || !canManage;
            return (
              <li key={m.user_id} className="flex flex-wrap items-center gap-3 p-4">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-text">
                    {m.display_name}
                    {m.user_id === me?.id && ' (you)'}
                  </span>
                  <span className="text-xs text-text-muted">{m.role}</span>
                </span>
                <label className="inline-flex items-center gap-2 text-sm text-text">
                  <input
                    type="checkbox"
                    checked={m.can_stream}
                    disabled={locked}
                    aria-busy={pending === m.user_id || undefined}
                    onChange={(e) => update(m, { can_stream: e.target.checked })}
                  />
                  Can share screen
                </label>
                {info.my_role === 'owner' && m.role !== 'owner' && (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={pending === m.user_id}
                    onClick={() => update(m, { role: m.role === 'admin' ? 'member' : 'admin' })}
                  >
                    {m.role === 'admin' ? 'Remove admin' : 'Make admin'}
                  </Button>
                )}
                {m.role !== 'owner' && (canManage || m.user_id === me?.id) && (
                  <Button size="sm" variant="ghost" disabled={pending === m.user_id} onClick={() => remove(m)}>
                    {m.user_id === me?.id ? 'Leave room' : 'Remove'}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-xs text-text-muted">
        Permission changes apply the next time someone joins the call.
      </p>
    </main>
  );
}
