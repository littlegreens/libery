import { FormEvent, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Link, useOutletContext } from 'react-router-dom';
import { api } from '@/lib/api';
import type { ShellOutletContext } from '@/components/AppShell';
import LiberyNumChip from '@/components/LiberyNumChip';
import { LiberyButton, MdTextField } from '@/lib/material/md-react';
import { useAuthStore, type AuthUser } from '@/stores/authStore';
import { useSlotsStore } from '@/stores/slotsStore';
import { toast } from '@/stores/toastStore';
import { useMdNativeFormBridge } from '@/lib/useMdNativeFormBridge';

type ProfileResponse = {
  user: AuthUser & {
    avatarUrl: string | null;
    createdAt: string;
    slots: {
      libriOggi: number;
      libriExtra: number;
      libriTotali: number;
      activeReservations: number;
      slotsFree: number;
    };
    aeroplanini: Array<{ type: string; earnedAt: string }>;
  };
};

type BackpackResponse = {
  taken: Array<{ id: string }>;
  donated: Array<{ id: string }>;
  reserved: Array<{ id: string }>;
};

function tfVal(e: Event) {
  return (e.currentTarget as HTMLElement & { value: string }).value;
}

const AEROPLANINO_LABELS: Record<string, string> = {
  primo_volo: 'Primo volo',
  esploratore: 'Esploratore',
  custode: 'Custode',
  grande_donatore: 'Grande donatore',
  viaggiatore: 'Viaggiatore',
};

function profileInitials(user: AuthUser | null, fallbackName: string): string {
  const name = user?.displayName?.trim() || fallbackName.trim();
  if (name && name.includes('@') === false) {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }
  return (user?.email ?? '?').slice(0, 2).toUpperCase();
}

export default function ProfilePage() {
  const loggedIn = useAuthStore((s) => s.isLoggedIn());
  const authUser = useAuthStore((s) => s.user);
  const setAuth = useAuthStore((s) => s.setAuth);
  const accessToken = useAuthStore((s) => s.accessToken);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const { openAuthSheet, setPageBar } = useOutletContext<ShellOutletContext>();
  const refreshSlots = useSlotsStore((s) => s.refreshSlots);
  const slotsFree = useSlotsStore((s) => s.slots?.slotsFree ?? profile?.slots.slotsFree ?? 0);

  const [profile, setProfile] = useState<ProfileResponse['user'] | null>(null);
  const [stats, setStats] = useState({ taken: 0, donated: 0, reserved: 0 });
  const [displayName, setDisplayName] = useState('');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  useMdNativeFormBridge(formRef);

  const savedAvatarUrl = profile?.avatarUrl ?? authUser?.avatarUrl ?? null;
  const heroAvatarSrc = avatarPreview ?? savedAvatarUrl;

  useEffect(() => {
    if (!loggedIn) {
      setPageBar({
        title: 'Profilo',
        subtitle: 'Accedi per gestire account e sicurezza.',
        showBack: false,
      });
      return () => setPageBar(null);
    }
    setPageBar({ title: 'Il mio profilo', showBack: false });
    return () => setPageBar(null);
  }, [loggedIn, setPageBar]);

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
        setStats({
          taken: backpackRes.data.taken.length,
          donated: backpackRes.data.donated.length,
          reserved: backpackRes.data.reserved.length,
        });
        void refreshSlots();
      })
      .catch(() => {
        if (!cancelled) toast.error('Profilo non disponibile');
      });

    return () => {
      cancelled = true;
    };
  }, [loggedIn, refreshSlots]);


  useEffect(() => {
    return () => {
      if (avatarPreview?.startsWith('blob:')) URL.revokeObjectURL(avatarPreview);
    };
  }, [avatarPreview]);

  if (!loggedIn) {
    return (
      <div className="page-content px-3 py-4 text-center">
        <LiberyButton type="button" color="outlined" size="small" onClick={() => openAuthSheet('login')}>
          Login
        </LiberyButton>
      </div>
    );
  }

  function onAvatarPick(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.warning('Scegli un\'immagine JPG, PNG o WebP');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.warning('Immagine troppo grande (max 2 MB)');
      return;
    }
    if (avatarPreview?.startsWith('blob:')) URL.revokeObjectURL(avatarPreview);
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (saving) return;

    const wantsPassword =
      currentPassword.length > 0 || newPassword.length > 0 || confirmPassword.length > 0;

    if (wantsPassword) {
      if (!currentPassword || !newPassword) {
        toast.warning('Per cambiare password compila attuale e nuova');
        return;
      }
      if (newPassword.length < 8) {
        toast.warning('La nuova password deve avere almeno 8 caratteri');
        return;
      }
      if (newPassword !== confirmPassword) {
        toast.warning('Le password non coincidono');
        return;
      }
    }

    setSaving(true);
    try {
      let latestUser: AuthUser | null = null;

      if (avatarFile) {
        const fd = new FormData();
        fd.append('avatar', avatarFile);
        const { data } = await api.post<{ user: AuthUser; avatarUrl: string }>('/user/avatar', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        latestUser = {
          ...data.user,
          avatarUrl: `${data.avatarUrl}?v=${Date.now()}`,
        };
        setAvatarFile(null);
        if (avatarPreview?.startsWith('blob:')) URL.revokeObjectURL(avatarPreview);
        setAvatarPreview(null);
      }

      const patchBody: Record<string, string | null> = {
        displayName: displayName.trim() || null,
      };
      if (wantsPassword) {
        patchBody.currentPassword = currentPassword;
        patchBody.newPassword = newPassword;
      }

      const { data } = await api.patch<{ user: AuthUser }>('/user/profile', patchBody);
      latestUser = data.user;

      if (accessToken && refreshToken && latestUser) {
        setAuth({ accessToken, refreshToken, user: latestUser });
        setProfile((p) => (p ? { ...p, ...latestUser! } : p));
      }

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success('Profilo salvato');
    } catch (err) {
      const msg = axios.isAxiosError(err)
        ? (err.response?.data as { error?: string })?.error ?? 'Salvataggio fallito'
        : 'Errore di rete';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  const initials = profileInitials(authUser, displayName);

  return (
    <div className="page-content profile-page profile-page--linear px-3 py-3 pb-5">
      <section className="profile-hero profile-hero--linear mb-3">
        <button
          type="button"
          className="profile-avatar profile-avatar--tap"
          aria-label="Cambia foto profilo"
          onClick={() => fileInputRef.current?.click()}
        >
          {heroAvatarSrc ? (
            <img src={heroAvatarSrc} alt="" />
          ) : (
            <span>{initials}</span>
          )}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="visually-hidden"
          onChange={(ev) => onAvatarPick(ev.target.files?.[0])}
        />
        <div className="min-w-0 flex-grow-1">
          <div className="fw-bold">{displayName.trim() || authUser?.email}</div>
          <div className="small text-muted">{authUser?.email}</div>
          <button
            type="button"
            className="profile-change-photo mt-1"
            onClick={() => fileInputRef.current?.click()}
          >
            Cambia foto
          </button>
        </div>
      </section>

      <section className="profile-stats mb-3" aria-label="Statistiche">
        <div className="profile-stat profile-stat--primary">
          <LiberyNumChip
            value={slotsFree}
            aria-label={`Puoi prendere ancora ${slotsFree} libri`}
          />
          <span className="profile-stat-label">Puoi prendere</span>
        </div>
        <div className="profile-stat">
          <LiberyNumChip value={stats.taken} />
          <span className="profile-stat-label">Ricevuti</span>
        </div>
        <div className="profile-stat">
          <LiberyNumChip value={stats.donated} />
          <span className="profile-stat-label">Donati</span>
        </div>
      </section>

      {profile && profile.aeroplanini.length > 0 && (
        <section className="mb-3">
          <h2 className="profile-section-title">Aeroplanini</h2>
          <ul className="list-unstyled mb-0 profile-aeroplanini">
            {profile.aeroplanini.map((a) => (
              <li key={a.type} className="d-flex justify-content-between gap-2">
                <span>{AEROPLANINO_LABELS[a.type] ?? a.type}</span>
                <span className="small text-muted">
                  {new Date(a.earnedAt).toLocaleDateString('it-IT')}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="small mb-3">
        <Link to="/diventa-punto" className="profile-text-link">Proponi biblioteca, libreria o Corner Free</Link>
        {' · '}
        <Link to="/verifica-email" className="profile-text-link">Verifica email</Link>
      </p>

      <form ref={formRef} className="profile-form" onSubmit={handleSave}>
        <h2 className="profile-section-title">Account</h2>
        <MdTextField
          className="mb-2"
          style={{ width: '100%' }}
          id="prof-name"
          label="Nome visualizzato"
          type="text"
          value={displayName}
          placeholder="Come vuoi essere chiamato"
          maxLength={80}
          onInput={(e: Event) => setDisplayName(tfVal(e))}
        />

        <p className="profile-field-hint mb-2">Password (lascia vuoto per non cambiarla)</p>
        <MdTextField
          className="mb-2"
          style={{ width: '100%' }}
          id="pw-current"
          label="Password attuale"
          type="password"
          value={currentPassword}
          autocomplete="current-password"
          onInput={(e: Event) => setCurrentPassword(tfVal(e))}
        />
        <MdTextField
          className="mb-2"
          style={{ width: '100%' }}
          id="pw-new"
          label="Nuova password"
          type="password"
          value={newPassword}
          minLength={8}
          autocomplete="new-password"
          supportingText="Almeno 8 caratteri"
          onInput={(e: Event) => setNewPassword(tfVal(e))}
        />
        <MdTextField
          className="mb-0"
          style={{ width: '100%' }}
          id="pw-confirm"
          label="Conferma nuova password"
          type="password"
          value={confirmPassword}
          minLength={8}
          autocomplete="new-password"
          onInput={(e: Event) => setConfirmPassword(tfVal(e))}
        />

        <div className="profile-save-bar">
          <LiberyButton
            type="button"
            color="outlined"
            className="w-100"
            disabled={saving}
            onClick={() => formRef.current?.requestSubmit()}
          >
            {saving ? 'Salvataggio…' : 'Salva'}
          </LiberyButton>
        </div>
      </form>
    </div>
  );
}
