import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type UserRole = 'user' | 'point_staff' | 'point_manager' | 'admin';

export type AuthUser = {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl?: string | null;
  role: UserRole;
  libriExtra: number;
  libriOggiUsed: number;
};

type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  setAuth: (payload: { accessToken: string; refreshToken: string; user: AuthUser }) => void;
  logout: () => void;
  isLoggedIn: () => boolean;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      setAuth: ({ accessToken, refreshToken, user }) =>
        set({ accessToken, refreshToken, user }),
      logout: () => set({ accessToken: null, refreshToken: null, user: null }),
      isLoggedIn: () => Boolean(get().accessToken && get().user),
    }),
    { name: 'libery-auth' },
  ),
);
