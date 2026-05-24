import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuthHydrated } from '@/hooks/useAuthHydrated';
import { useAuthStore, type AuthUser } from '@/stores/authStore';

function mapMeUser(raw: Record<string, unknown>): AuthUser {
  return {
    id: String(raw.id),
    email: String(raw.email),
    displayName: (raw.displayName as string | null) ?? null,
    avatarUrl: (raw.avatarUrl as string | null | undefined) ?? null,
    role: raw.role as AuthUser['role'],
    libriExtra: Number(raw.libriExtra ?? 0),
    libriOggiUsed: Number(raw.libriOggiUsed ?? 0),
    emailVerified: Boolean(raw.emailVerified),
  };
}

/**
 * Dopo l’idratazione persist: se c’è token ma manca `user`, ricarica da `/auth/me`.
 * Evita redirect prematuri (es. admin bianco al refresh).
 */
export function useSessionBootstrap() {
  const hydrated = useAuthHydrated();
  const accessToken = useAuthStore((s) => s.accessToken);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const user = useAuthStore((s) => s.user);
  const setAuth = useAuthStore((s) => s.setAuth);
  const logout = useAuthStore((s) => s.logout);
  const [booting, setBooting] = useState(false);

  useEffect(() => {
    if (!hydrated || user || !accessToken) return;

    let cancelled = false;
    setBooting(true);

    api
      .get('/auth/me')
      .then(({ data }) => {
        if (cancelled) return;
        setAuth({
          accessToken,
          refreshToken: refreshToken ?? '',
          user: mapMeUser(data.user as Record<string, unknown>),
        });
      })
      .catch(() => {
        if (!cancelled) logout();
      })
      .finally(() => {
        if (!cancelled) setBooting(false);
      });

    return () => {
      cancelled = true;
    };
  }, [hydrated, user, accessToken, refreshToken, setAuth, logout]);

  const ready = hydrated && !booting;
  return { ready, user, accessToken };
}
