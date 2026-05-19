import axios, {
  type AxiosError,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';
import { useAuthStore } from '@/stores/authStore';

export const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * Stato globale del refresh: un solo refresh in volo, le richieste concorrenti
 * si mettono in coda e ricevono il nuovo token quando arriva.
 */
let refreshing: Promise<string | null> | null = null;

async function performRefresh(): Promise<string | null> {
  const refreshToken = useAuthStore.getState().refreshToken;
  if (!refreshToken) return null;
  try {
    const { data } = await axios.post<{ accessToken: string; refreshToken: string }>(
      '/api/auth/refresh',
      { refreshToken },
    );
    const current = useAuthStore.getState();
    if (current.user) {
      current.setAuth({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        user: current.user,
      });
    }
    return data.accessToken;
  } catch {
    useAuthStore.getState().logout();
    return null;
  }
}

type RetryableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetryableConfig | undefined;
    const status = error.response?.status;

    // Niente refresh per le rotte auth stesse o se già abbiamo riprovato
    const url = original?.url ?? '';
    const isAuthCall = url.startsWith('/auth/') || url.includes('/auth/refresh');

    if (
      status === 401 &&
      original &&
      !original._retry &&
      !isAuthCall &&
      useAuthStore.getState().refreshToken
    ) {
      original._retry = true;
      try {
        refreshing = refreshing ?? performRefresh();
        const newToken = await refreshing;
        refreshing = null;
        if (newToken) {
          original.headers.Authorization = `Bearer ${newToken}`;
          return api.request(original as AxiosRequestConfig);
        }
      } catch {
        refreshing = null;
      }
    }

    return Promise.reject(error);
  },
);
