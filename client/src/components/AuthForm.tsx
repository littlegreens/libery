import { FormEvent, useState } from 'react';
import axios from 'axios';
import { api } from '@/lib/api';
import { useAuthStore, type AuthUser } from '@/stores/authStore';

type Mode = 'login' | 'register';

type Props = {
  initialMode?: Mode;
  onSuccess?: (user: AuthUser) => void;
};

function apiError(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { error?: string } | undefined;
    if (data?.error) return data.error;
    if (err.response?.status === 409) return 'Email già registrata';
    if (err.response?.status === 400) return 'Controlla i dati inseriti';
  }
  return fallback;
}

export default function AuthForm({ initialMode = 'login', onSuccess }: Props) {
  const setAuth = useAuthStore((s) => s.setAuth);
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const endpoint = mode === 'login' ? '/auth/login' : '/auth/register';
      const { data } = await api.post(endpoint, {
        email,
        password,
        ...(mode === 'register' ? { displayName: displayName.trim() || undefined } : {}),
      });
      setAuth(data);
      onSuccess?.(data.user);
    } catch (err) {
      setError(apiError(err, mode === 'login' ? 'Credenziali non valide' : 'Registrazione non riuscita'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="auth-tabs mb-3">
        <button
          type="button"
          className={`auth-tab ${mode === 'login' ? 'active' : ''}`}
          onClick={() => { setMode('login'); setError(''); }}
        >
          Accedi
        </button>
        <button
          type="button"
          className={`auth-tab ${mode === 'register' ? 'active' : ''}`}
          onClick={() => { setMode('register'); setError(''); }}
        >
          Registrati
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        {error ? <div className="alert alert-libery-danger py-2 small mb-3">{error}</div> : null}

        {mode === 'register' && (
          <div className="mb-3">
            <label className="form-label" htmlFor="sheet-displayName">Nome</label>
            <input
              id="sheet-displayName"
              type="text"
              className="form-control"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Come ti chiami?"
              autoComplete="name"
            />
          </div>
        )}

        <div className="mb-3">
          <label className="form-label" htmlFor="sheet-email">Email</label>
          <input
            id="sheet-email"
            type="email"
            className="form-control"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>

        <div className="mb-4">
          <label className="form-label" htmlFor="sheet-password">Password</label>
          <input
            id="sheet-password"
            type="password"
            className="form-control"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={mode === 'register' ? 8 : 6}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />
          {mode === 'register' && <div className="form-text">Almeno 8 caratteri</div>}
        </div>

        <button type="submit" className="btn btn-libery w-100" disabled={loading}>
          {loading ? 'Attendere…' : mode === 'login' ? 'Entra in Libery' : 'Crea account'}
        </button>
      </form>
    </>
  );
}

