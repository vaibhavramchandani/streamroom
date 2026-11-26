import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { api, session } from './api';
import type { Me } from './api';

interface AuthState {
  me: Me | null;
  loading: boolean;
  signIn: (name: string, plan: 'free' | 'hd') => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(() => !!session.get());

  useEffect(() => {
    if (!session.get()) return;
    api
      .me()
      .then(setMe)
      .catch(() => setMe(null))
      .finally(() => setLoading(false));
  }, []);

  const signIn = useCallback(async (name: string, plan: 'free' | 'hd') => {
    const { token, me } = await api.devSignIn(name, plan);
    session.set(token);
    setMe(me);
  }, []);

  const signOut = useCallback(() => {
    session.set(null);
    setMe(null);
  }, []);

  return <AuthContext.Provider value={{ me, loading, signIn, signOut }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside AuthProvider');
  return ctx;
}
