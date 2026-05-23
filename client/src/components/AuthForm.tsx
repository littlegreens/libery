import { FormEvent, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { api } from '@/lib/api';
import { useAuthStore, type AuthUser } from '@/stores/authStore';
import { LiberyButton, MdTextField } from '@/lib/material/md-react';
import { useMdNativeFormBridge } from '@/lib/useMdNativeFormBridge';
import RegisterPointPanel from '@/components/RegisterPointPanel';
import {
  emptyPointRequestDraft,
  pointRequestDraftToPayload,
  validatePointRequestDraft,
  type PointRequestDraft,
} from '@/lib/pointRequestDraft';

type Mode = 'login' | 'register';

type Props = {
  initialMode?: Mode;
  onSuccess?: (user: AuthUser) => void;
};

function apiError(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { error?: string; code?: string; email?: string } | undefined;
    if (data?.code === 'EMAIL_NOT_VERIFIED') {
      return 'Conferma la tua email prima di accedere. Controlla la posta o richiedi un nuovo link.';
    }
    if (data?.error) return data.error;
    if (err.response?.status === 409) return 'Email già registrata';
    if (err.response?.status === 400) return 'Controlla i dati inseriti';
  }
  return fallback;
}

function readFieldValue(e: Event) {
  return (e.currentTarget as HTMLElement & { value: string }).value;
}

export default function AuthForm({ initialMode = 'login', onSuccess }: Props) {
  const setAuth = useAuthStore((s) => s.setAuth);
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isResponsible, setIsResponsible] = useState(false);
  const [pointDraft, setPointDraft] = useState<PointRequestDraft>(emptyPointRequestDraft);
  const [pointError, setPointError] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  useMdNativeFormBridge(formRef);

  function resetPointPanel() {
    setIsResponsible(false);
    setPointDraft(emptyPointRequestDraft());
    setPointError(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setInfo('');
    setPointError(null);
    setLoading(true);
    try {
      if (mode === 'register') {
        let pointPayload: ReturnType<typeof pointRequestDraftToPayload> | undefined;
        if (isResponsible) {
          const validation = validatePointRequestDraft(pointDraft);
          if (validation) {
            setPointError(validation);
            setLoading(false);
            return;
          }
          pointPayload = pointRequestDraftToPayload(pointDraft);
        }

        const { data } = await api.post<{
          needsEmailVerification?: boolean;
          message?: string;
          email?: string;
          pointRequestSubmitted?: boolean;
        }>('/auth/register', {
          email,
          password,
          displayName: displayName.trim() || undefined,
          pointRequest: pointPayload,
        });
        if (data.needsEmailVerification) {
          setInfo(
            data.message ??
              `Ti abbiamo inviato un'email a ${data.email ?? email}. Apri il link per attivare l'account.`,
          );
          resetPointPanel();
          setMode('login');
          return;
        }
      }

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

  const tabIdLogin = 'auth-tab-login';
  const tabIdRegister = 'auth-tab-register';

  return (
    <>
      <div
        role="tablist"
        aria-label="Accesso o registrazione"
        className="libery-primary-tabs mb-3"
      >
        <button
          type="button"
          role="tab"
          id={tabIdLogin}
          aria-selected={mode === 'login'}
          tabIndex={mode === 'login' ? 0 : -1}
          className="libery-primary-tab"
          onClick={() => {
            setMode('login');
            setError('');
            setInfo('');
            resetPointPanel();
          }}
        >
          Login
        </button>
        <button
          type="button"
          role="tab"
          id={tabIdRegister}
          aria-selected={mode === 'register'}
          tabIndex={mode === 'register' ? 0 : -1}
          className="libery-primary-tab"
          onClick={() => {
            setMode('register');
            setError('');
            setInfo('');
          }}
        >
          Registrati
        </button>
      </div>

      <form
        ref={formRef}
        onSubmit={handleSubmit}
        role="tabpanel"
        aria-labelledby={mode === 'login' ? tabIdLogin : tabIdRegister}
      >
        {error ? (
          <div className="libery-inline-alert libery-inline-alert-danger mb-3 small" role="alert">
            {error}
            {error.includes('email') ? (
              <p className="mb-0 mt-2">
                <Link to="/verifica-email">Verifica email o reinvia link</Link>
              </p>
            ) : null}
          </div>
        ) : null}

        {info ? (
          <div className="libery-inline-alert libery-inline-alert-success mb-3 small" role="status">
            {info}
            <p className="mb-0 mt-2">
              <Link to="/verifica-email">Apri pagina verifica</Link>
            </p>
          </div>
        ) : null}

        {mode === 'register' && (
          <MdTextField
            className="mb-3"
            style={{ width: '100%' }}
            label="Nome"
            type="text"
            value={displayName}
            placeholder="Come ti chiami?"
            autocomplete="name"
            onInput={(e: Event) => setDisplayName(readFieldValue(e))}
          />
        )}

        <MdTextField
          className="mb-3"
          style={{ width: '100%' }}
          label="Email"
          type="email"
          value={email}
          required
          autocomplete="email"
          onInput={(e: Event) => setEmail(readFieldValue(e))}
        />

        <MdTextField
          className="mb-3"
          style={{ width: '100%' }}
          label="Password"
          type="password"
          value={password}
          required
          minLength={mode === 'register' ? 8 : 6}
          supportingText={mode === 'register' ? 'Almeno 8 caratteri' : ''}
          autocomplete={mode === 'register' ? 'new-password' : 'current-password'}
          onInput={(e: Event) => setPassword(readFieldValue(e))}
        />

        {mode === 'register' && (
          <>
            <label className="auth-responsible-check mb-2">
              <input
                type="checkbox"
                checked={isResponsible}
                onChange={(e) => {
                  const on = e.target.checked;
                  setIsResponsible(on);
                  setPointError(null);
                  if (!on) setPointDraft(emptyPointRequestDraft());
                }}
              />
              <span>
                Sono responsabile di una biblioteca, libreria o di un corner
              </span>
            </label>

            {isResponsible ? (
              <RegisterPointPanel
                value={pointDraft}
                onChange={setPointDraft}
                onLater={resetPointPanel}
                fieldError={pointError}
              />
            ) : null}
          </>
        )}

        <LiberyButton
          type="button"
          variant="primary"
          className="w-100"
          disabled={loading}
          onClick={() => formRef.current?.requestSubmit()}
        >
          {loading ? 'Attendere…' : mode === 'login' ? 'Login' : 'Crea account'}
        </LiberyButton>
      </form>
    </>
  );
}
