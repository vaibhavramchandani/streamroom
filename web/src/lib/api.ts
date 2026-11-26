// Thin client for the FastAPI backend. One place for the base URL and the session token.

export interface Plan {
  id: string;
  name: string;
  max_height: number;
  max_fps: number;
}
export interface Me {
  id: string;
  display_name: string;
  plan: Plan;
}
export interface Member {
  user_id: string;
  display_name: string;
  role: 'owner' | 'admin' | 'member';
  can_stream: boolean;
}
export interface RoomInfo {
  id: string;
  name: string;
  invite_code: string;
  my_role: Member['role'];
  members: Member[];
}
export interface MediaToken {
  url: string;
  token: string;
  identity: string;
  room_name: string;
  can_stream: boolean;
  max_height: number;
  max_fps: number;
}

export const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000';
const KEY = 'streamroom.session';

// Browser storage can throw (private mode, some embeds), so every access is guarded.
export const session = {
  get(): string | null {
    try {
      return localStorage.getItem(KEY);
    } catch {
      return null;
    }
  },
  set(token: string | null) {
    try {
      if (token) localStorage.setItem(KEY, token);
      else localStorage.removeItem(KEY);
    } catch {
      /* stays signed in for this tab only */
    }
  },
};

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = session.get();
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Can’t reach the server. Check your connection and try again.');
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = typeof data.detail === 'string' ? data.detail : 'Something went wrong. Try again.';
    if (res.status === 401) session.set(null);
    throw new ApiError(res.status, detail);
  }
  return data as T;
}

export const api = {
  devSignIn: (display_name: string, plan_id: 'free' | 'hd') =>
    call<{ token: string; me: Me }>('POST', '/auth/dev', { display_name, plan_id }),
  me: () => call<Me>('GET', '/me'),
  rooms: () => call<RoomInfo[]>('GET', '/rooms'),
  createRoom: (name: string) => call<RoomInfo>('POST', '/rooms', { name }),
  joinRoom: (code: string) => call<RoomInfo>('POST', `/rooms/join/${encodeURIComponent(code)}`),
  room: (id: string) => call<RoomInfo>('GET', `/rooms/${id}`),
  patchMember: (roomId: string, userId: string, patch: Partial<Pick<Member, 'role' | 'can_stream'>>) =>
    call<RoomInfo>('PATCH', `/rooms/${roomId}/members/${userId}`, patch),
  removeMember: (roomId: string, userId: string) => call<void>('DELETE', `/rooms/${roomId}/members/${userId}`),
  mediaToken: (roomId: string) => call<MediaToken>('POST', `/rooms/${roomId}/token`),
};
