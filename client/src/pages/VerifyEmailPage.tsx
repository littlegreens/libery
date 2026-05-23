import { FormEvent, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { LiberyButton, MdTextField } from '@/lib/material/md-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const tokenFromUrl = searchParams.get('token') ?? '';
  const [token, setToken] = useState(tokenFromUrl);
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [message, setMessage] = useState('');

  useDocumentTitle('Verifica email');

  useEffect(() => {
    if (!tokenFromUrl) return;
    const controller = new AbortController();
    setStatus('loading');
    api
      .post('/auth/verify-email', { token: tokenFromUrl }, { signal: controller.signal })
      .then(() => {
        setStatus('ok');
        setMessage('Email verificata.');
      })
      .catch((err) => {
        if (err?.code === 'ERR_CANCELED') return;
        setStatus('error');
        const data = (err as { response?: { data?: { error?: string } } })?.response?.data;
        setMessage(data?.error ?? 'Verifica non riuscita');
      });
    return () => controller.abort();
  }, [tokenFromUrl]);

  async function handleVerify(e: FormEvent) {
    e.preventDefault();
    setStatus('loading');
    setMessage('');
    try {
      await api.post('/auth/verify-email', { token: token.trim() });
      setStatus('ok');
      setMessage('Email verificata. Ora puoi accedere.');
    } catch (err) {
      setStatus('error');
      const data = (err as { response?: { data?: { error?: string } } })?.response?.data;
      setMessage(data?.error ?? 'Verifica non riuscita');
    }
  }

  async function handleResend(e: FormEvent) {
    e.preventDefault();
    setStatus('loading');
    try {
      await api.post('/auth/resend-verification', { email: email.trim() });
      setStatus('ok');
      setMessage('Se l\'account esiste, riceverai una nuova email.');
    } catch {
      setStatus('error');
      setMessage('Invio non riuscito');
    }
  }

  return (
    <div className="page-content px-3 py-4" style={{ maxWidth: 420, margin: '0 auto' }}>
      <h1 className="h4 fw-bold mb-3">Verifica email</h1>

      {message ? (
        <div
          className={`libery-inline-alert mb-3 small ${
            status === 'ok' ? 'libery-inline-alert-success' : 'libery-inline-alert-danger'
          }`}
          role={status === 'error' ? 'alert' : 'status'}
          aria-live={status === 'error' ? 'assertive' : 'polite'}
        >
          {message}
        </div>
      ) : null}

      {!tokenFromUrl && status !== 'ok' ? (
        <form onSubmit={handleVerify} className="mb-4">
          <MdTextField
            className="mb-3"
            style={{ width: '100%' }}
            label="Codice dal link email"
            value={token}
            required
            onInput={(e: Event) =>
              setToken((e.currentTarget as HTMLElement & { value: string }).value)
            }
          />
          <LiberyButton type="button" color="filled" className="w-100" disabled={status === 'loading'} onClick={() => void handleVerify({ preventDefault: () => {} } as FormEvent)}>
            Conferma
          </LiberyButton>
        </form>
      ) : null}

      <form onSubmit={handleResend}>
        <p className="small text-muted">Non hai ricevuto l&apos;email?</p>
        <MdTextField
          className="mb-3"
          style={{ width: '100%' }}
          label="La tua email"
          type="email"
          value={email}
          required
          onInput={(e: Event) =>
            setEmail((e.currentTarget as HTMLElement & { value: string }).value)
          }
        />
        <LiberyButton type="button" color="tonal" className="w-100" disabled={status === 'loading'} onClick={() => void handleResend({ preventDefault: () => {} } as FormEvent)}>
          Invia di nuovo
        </LiberyButton>
      </form>

      <p className="mt-4 small">
        <Link to="/entra">Vai al login</Link>
      </p>
    </div>
  );
}
