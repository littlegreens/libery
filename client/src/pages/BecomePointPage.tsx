import { FormEvent, useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import axios from 'axios';
import { api } from '@/lib/api';
import type { ShellOutletContext } from '@/components/AppShell';
import type { PointType } from '@/types/point';
import { LiberyButton, MdTextField } from '@/lib/material/md-react';
import { useAuthStore } from '@/stores/authStore';

type RequestRow = {
  id: string;
  name: string;
  pointType: PointType;
  status: string;
  createdAt: string;
};

export default function BecomePointPage() {
  const { openAuthSheet, setPageBar } = useOutletContext<ShellOutletContext>();
  const loggedIn = useAuthStore((s) => s.isLoggedIn());
  const [pointType, setPointType] = useState<PointType>('biblioteca');
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [mine, setMine] = useState<RequestRow[]>([]);
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setPageBar({ title: 'Diventa punto Libery', showBack: true });
    return () => setPageBar(null);
  }, [setPageBar]);

  useEffect(() => {
    if (!loggedIn) return;
    api
      .get<{ requests: RequestRow[] }>('/point-requests/mine')
      .then(({ data }) => setMine(data.requests))
      .catch(() => setMine([]));
  }, [loggedIn]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!loggedIn) {
      openAuthSheet('register');
      return;
    }
    setLoading(true);
    setFeedback('');
    try {
      await api.post('/point-requests', {
        pointType,
        name: name.trim(),
        city: city.trim() || undefined,
        address: address.trim() || undefined,
        contactEmail: contactEmail.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      setFeedback('Richiesta inviata. L\'admin la esaminerà a breve.');
      setName('');
      setNotes('');
      const { data } = await api.get<{ requests: RequestRow[] }>('/point-requests/mine');
      setMine(data.requests);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const data = err.response?.data as { error?: string; code?: string };
        if (data?.code === 'EMAIL_NOT_VERIFIED') {
          setFeedback('Verifica prima la tua email (Profilo o link ricevuto).');
        } else {
          setFeedback(data?.error ?? 'Invio non riuscito');
        }
      } else {
        setFeedback('Invio non riuscito');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-content px-3 py-3">
      <p className="small text-muted mb-3">
        Proponi biblioteca, libreria o Corner Free. Dopo l&apos;approvazione admin creeremo il punto e
        l&apos;account responsabile; potrai poi abilitare gli addetti.
      </p>

      {!loggedIn ? (
        <LiberyButton type="button" color="filled" className="mb-3" onClick={() => openAuthSheet('login')}>
          Accedi per inviare la richiesta
        </LiberyButton>
      ) : (
        <form onSubmit={handleSubmit} className="libery-field-stack mb-4">
          <label className="small fw-semibold">Tipo punto</label>
          <select
            className="form-select mb-3"
            value={pointType}
            onChange={(e) => setPointType(e.target.value as PointType)}
          >
            <option value="biblioteca">Biblioteca</option>
            <option value="libreria">Libreria</option>
            <option value="corner_free">Corner Free</option>
          </select>

          <MdTextField
            style={{ width: '100%' }}
            label="Nome punto"
            value={name}
            required
            onInput={(e: Event) =>
              setName((e.currentTarget as HTMLElement & { value: string }).value)
            }
          />
          <MdTextField
            style={{ width: '100%' }}
            label="Città"
            value={city}
            onInput={(e: Event) =>
              setCity((e.currentTarget as HTMLElement & { value: string }).value)
            }
          />
          <MdTextField
            style={{ width: '100%' }}
            label="Indirizzo"
            value={address}
            onInput={(e: Event) =>
              setAddress((e.currentTarget as HTMLElement & { value: string }).value)
            }
          />
          <MdTextField
            style={{ width: '100%' }}
            label="Email contatto (opzionale)"
            type="email"
            value={contactEmail}
            onInput={(e: Event) =>
              setContactEmail((e.currentTarget as HTMLElement & { value: string }).value)
            }
          />
          <MdTextField
            style={{ width: '100%' }}
            label="Note"
            value={notes}
            onInput={(e: Event) =>
              setNotes((e.currentTarget as HTMLElement & { value: string }).value)
            }
          />

          {feedback ? (
            <div className="libery-inline-alert libery-inline-alert-info small">{feedback}</div>
          ) : null}

          <LiberyButton type="button" color="filled" disabled={loading} onClick={() => void handleSubmit({ preventDefault: () => {} } as FormEvent)}>
            {loading ? 'Invio…' : 'Invia richiesta'}
          </LiberyButton>
        </form>
      )}

      {mine.length > 0 && (
        <section>
          <h2 className="h6 fw-bold mb-2">Le tue richieste</h2>
          <ul className="list-unstyled small">
            {mine.map((r) => (
              <li key={r.id} className="mb-2">
                <strong>{r.name}</strong> ({r.pointType}) —{' '}
                {r.status === 'pending' ? 'in attesa' : r.status}
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="small mt-3">
        <Link to="/home">Torna alla home</Link>
      </p>
    </div>
  );
}
