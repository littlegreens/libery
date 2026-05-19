import { FormEvent, useEffect, useState } from 'react';
import axios from 'axios';
import { Link, useOutletContext } from 'react-router-dom';
import { api } from '@/lib/api';
import BackLink from '@/components/BackLink';
import { useAuthStore, type AuthUser } from '@/stores/authStore';
import { toast } from '@/stores/toastStore';
import type { ShellOutletContext } from '@/components/AppShell';

type ProfileResponse = {
  user: AuthUser & {
    avatarUrl: string | null;
    createdAt: string;
    slots: { libriOggi: number; libriExtra: number; libriTotali: number };
    aeroplanini: Array<{ type: string; earnedAt: string }>;
  };
};

type BackpackResponse = {
  taken: Array<{ id: string }>;
  donated: Array<{ id: string }>;
  reserved: Array<{ id: string }>;
};

const AEROPLANINO_LABELS: Record<string, string> = {
  primo_volo: 'Primo volo',
  esploratore: 'Esploratore',
  custode: 'Custode',
  grande_donatore: 'Grande donatore',
  viaggiatore: 'Viaggiatore',
};

export default function ProfilePage() {
  const loggedIn = useAuthStore((s) => s.isLoggedIn());
  const authUser = useAuthStore((s) => s.user);
  const setAuth = useAuthStore((s) => s.setAuth);
  const accessToken = useAuthStore((s) => s.accessToken);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const logout = useAuthStore((s) => s.logout);
  const { openAuthSheet } = useOutletContext<ShellOutletContext>();

  const [profile, setProfile] = useState<ProfileResponse['user'] | null>(null);
  const [stats, setStats] = useState<{ taken: number; donated: number; reserved: number }>({
    taken: 0,
    donated: 0,
    reserved: 0,
  });
  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (!loggedIn) return;
    let cancelled = false;

    Promise.all([
      api.get<ProfileResponse>('/user/profile'),
      api.get<BackpackResponse>('/user/backpack'),
    ])
      .then(([profileRes, backpackRes]) => {
        if (cancelled) return;
        setProfile(profileRes.data.user);
        setDisplayName(profileRes.data.user.displayName ?? '');
        setAvatarUrl(profileRes.data.user.avatarUrl ?? '');
        setStats({
          taken: backpackRes.data.taken.length,
          donated: backpackRes.data.donated.length,
          reserved: backpackRes.data.reserved.length,
        });
      })
      .catch(() => {
        if (!cancelled) toast.error('Profilo non disponibile');
      });

    return () => {
      cancelled = true;
    };
  }, [loggedIn]);

  if (!loggedIn) {
    return (
      <div className="page-content px-3 py-4 text-center">
        <h1 className="h5 fw-bold mb-3">Profilo</h1>
        <p className="text-muted mb-3">Accedi per gestire il tuo profilo.</p>
        <button type="button" className="btn btn-libery btn-sm" onClick={() => openAuthSheet('login')}>
          Accedi
        </button>
      </div>
    );
  }

  async function handleSaveProfile(e: FormEvent) {
    e.preventDefault();
    if (savingProfile) return;
    setSavingProfile(true);
    try {
      const payload: Record<string, string | null> = {
        displayName: displayName.trim() || null,
        avatarUrl: avatarUrl.trim() || null,
      };
      const { data } = await api.patch<{ user: AuthUser }>('/user/profile', payload);
      if (accessToken && refreshToken) {
        setAuth({ accessToken, refreshToken, user: data.user });
      }
      toast.success('Profilo aggiornato');
    } catch (err) {
      const msg = axios.isAxiosError(err)
        ? (err.response?.data as { error?: string })?.error ?? 'Salvataggio fallito'
        : 'Errore di rete';
      toast.error(msg);
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault();
    if (savingPassword) return;
    if (newPassword.length < 8) {
      toast.warning('La nuova password deve avere almeno 8 caratteri');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.warning('Le password non coincidono');
      return;
    }
    setSavingPassword(true);
    try {
      await api.post('/user/change-password', { currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success('Password aggiornata');
    } catch (err) {
      const msg = axios.isAxiosError(err)
        ? (err.response?.data as { error?: string })?.error ?? 'Cambio password fallito'
        : 'Errore di rete';
      toast.error(msg);
    } finally {
      setSavingPassword(false);
    }
  }

  const initials = (authUser?.displayName ?? authUser?.email ?? '?').slice(0, 2).toUpperCase();

  return (
    <div className="page-content profile-page px-3 py-3">
      <BackLink />
      <h1 className="h5 fw-bold mb-3">Il mio profilo</h1>

      <section className="profile-hero d-flex align-items-center gap-3 mb-4">
        <div className="profile-avatar">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')} />
          ) : (
            <span>{initials}</span>
          )}
        </div>
        <div className="min-w-0">
          <div className="fw-bold">{profile?.displayName ?? authUser?.displayName ?? authUser?.email}</div>
          <div className="small text-muted">{authUser?.email}</div>
          <div className="small text-muted">Ruolo: {authUser?.role}</div>
        </div>
      </section>

      <section className="mb-4">
        <h2 className="h6 fw-bold mb-2">Statistiche</h2>
        <div className="profile-stats">
          <div className="profile-stat">
            <span className="profile-stat-value">{stats.taken}</span>
            <span className="profile-stat-label">Libri presi</span>
          </div>
          <div className="profile-stat">
            <span className="profile-stat-value">{stats.donated}</span>
            <span className="profile-stat-label">Libri donati</span>
          </div>
          <div className="profile-stat">
            <span className="profile-stat-value">{stats.reserved}</span>
            <span className="profile-stat-label">Prenotazioni attive</span>
          </div>
          <div className="profile-stat">
            <span className="profile-stat-value">{profile?.slots.libriOggi ?? 0}</span>
            <span className="profile-stat-label">Libri oggi</span>
          </div>
          <div className="profile-stat">
            <span className="profile-stat-value">{profile?.slots.libriExtra ?? 0}</span>
            <span className="profile-stat-label">Libri extra</span>
          </div>
          <div className="profile-stat">
            <span className="profile-stat-value">{profile?.aeroplanini.length ?? 0}</span>
            <span className="profile-stat-label">Aeroplanini</span>
          </div>
        </div>
      </section>

      {profile && profile.aeroplanini.length > 0 && (
        <section className="mb-4">
          <h2 className="h6 fw-bold mb-2">I tuoi Aeroplanini</h2>
          <ul className="list-unstyled mb-0 profile-aeroplanini">
            {profile.aeroplanini.map((a) => (
              <li key={a.type} className="d-flex justify-content-between">
                <span>{AEROPLANINO_LABELS[a.type] ?? a.type}</span>
                <span className="small text-muted">
                  {new Date(a.earnedAt).toLocaleDateString('it-IT')}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mb-4">
        <h2 className="h6 fw-bold mb-2">Dati personali</h2>
        <form onSubmit={handleSaveProfile}>
          <label className="form-label small mb-1" htmlFor="prof-name">Nome visualizzato</label>
          <input
            id="prof-name"
            type="text"
            className="form-control mb-2"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Come vuoi essere chiamato"
            maxLength={80}
          />
          <label className="form-label small mb-1" htmlFor="prof-avatar">URL avatar</label>
          <input
            id="prof-avatar"
            type="url"
            className="form-control mb-3"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            placeholder="https://…"
          />
          <button type="submit" className="btn btn-libery btn-sm" disabled={savingProfile}>
            {savingProfile ? 'Salvataggio…' : 'Salva modifiche'}
          </button>
        </form>
      </section>

      <section className="mb-4">
        <h2 className="h6 fw-bold mb-2">Cambia password</h2>
        <form onSubmit={handleChangePassword}>
          <label className="form-label small mb-1" htmlFor="pw-current">Password attuale</label>
          <input
            id="pw-current"
            type="password"
            className="form-control mb-2"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
          <label className="form-label small mb-1" htmlFor="pw-new">Nuova password</label>
          <input
            id="pw-new"
            type="password"
            className="form-control mb-2"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
          <label className="form-label small mb-1" htmlFor="pw-confirm">Conferma nuova password</label>
          <input
            id="pw-confirm"
            type="password"
            className="form-control mb-3"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
          <button type="submit" className="btn btn-libery btn-sm" disabled={savingPassword}>
            {savingPassword ? 'Aggiornamento…' : 'Cambia password'}
          </button>
        </form>
      </section>

      <section>
        <h2 className="h6 fw-bold mb-2">Sessione</h2>
        <button
          type="button"
          className="btn btn-outline-danger btn-sm"
          onClick={() => {
            logout();
            toast.info('Sei uscito');
          }}
        >
          Esci
        </button>
        <Link to="/zaino" className="btn btn-link btn-sm ms-2">
          Vai allo zaino
        </Link>
      </section>
    </div>
  );
}
