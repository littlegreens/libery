import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { LiberyButton, MdCard, MdTextField } from '@/lib/material/md-react';

type RequestRow = {
  id: string;
  name: string;
  pointType: string;
  city: string | null;
  status: string;
  contactEmail: string | null;
  createdAt: string;
  requester: { email: string; displayName: string | null };
};

export default function AdminRequests() {
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [filter, setFilter] = useState('pending');
  const [note, setNote] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState('');

  async function load() {
    const { data } = await api.get('/admin/requests', { params: { status: filter } });
    setRequests(data.requests);
  }

  useEffect(() => {
    load();
  }, [filter]);

  async function approve(id: string) {
    setFeedback('');
    try {
      const { data } = await api.post(`/admin/requests/${id}/approve`, {
        adminNote: note[id],
        managerEmail: note[`${id}-email`] || undefined,
      });
      const creds = data.managerCredentials;
      setFeedback(
        creds
          ? `Approvato. Gestore: ${creds.email} / password temporanea: ${creds.temporaryPassword}`
          : 'Richiesta approvata',
      );
      load();
    } catch {
      setFeedback('Errore approvazione — verifica email gestore');
    }
  }

  async function reject(id: string) {
    const adminNote = note[id];
    if (!adminNote?.trim()) {
      setFeedback('Inserisci una nota per il rifiuto');
      return;
    }
    await api.post(`/admin/requests/${id}/reject`, { adminNote });
    setFeedback('Richiesta rifiutata');
    load();
  }

  return (
    <div>
      <h1 className="h4 fw-bold mb-4">Richieste nuovi punti</h1>

      <div className="mb-3 d-flex flex-wrap gap-2">
        {(['pending', 'approved', 'rejected'] as const).map((s) => (
          <LiberyButton
            key={s}
            type="button"
            size="small"
            color={filter === s ? 'filled' : 'outlined'}
            onClick={() => setFilter(s)}
          >
            {s === 'pending' ? 'In attesa' : s === 'approved' ? 'Approvate' : 'Rifiutate'}
          </LiberyButton>
        ))}
      </div>

      {feedback && <div className="small libery-inline-alert libery-inline-alert-info mb-3">{feedback}</div>}

      {requests.length === 0 ? (
        <p className="text-muted">Nessuna richiesta in questa categoria.</p>
      ) : (
        <div className="d-flex flex-column gap-3">
          {requests.map((r) => (
            <MdCard key={r.id} type="elevated" style={{ padding: '1rem' }}>
              <div className="d-flex justify-content-between flex-wrap gap-2 mb-2">
                <div>
                  <h2 className="h6 fw-bold mb-1">{r.name}</h2>
                  <p className="small text-muted mb-0">
                    {r.pointType} · {r.city ?? '—'} · {new Date(r.createdAt).toLocaleDateString('it-IT')}
                  </p>
                </div>
                <span className="libery-badge align-self-start">{r.status}</span>
              </div>
              <p className="small mb-2">
                Richiedente: {r.requester.displayName ?? r.requester.email}
                {r.contactEmail && ` · Contatto: ${r.contactEmail}`}
              </p>
              {r.status === 'pending' && (
                <>
                  <MdTextField
                    className="mb-2 mt-2"
                    style={{ width: '100%' }}
                    label="Email gestore (se diversa dal contatto)"
                    type="email"
                    value={note[`${r.id}-email`] ?? ''}
                    onInput={(e: Event) =>
                      setNote({
                        ...note,
                        [`${r.id}-email`]: (e.currentTarget as HTMLElement & { value: string }).value,
                      })
                    }
                  />
                  <MdTextField
                    className="mb-2"
                    style={{ width: '100%' }}
                    label="Nota admin (obbligatoria per rifiuto)"
                    type="text"
                    value={note[r.id] ?? ''}
                    onInput={(e: Event) =>
                      setNote({
                        ...note,
                        [r.id]: (e.currentTarget as HTMLElement & { value: string }).value,
                      })
                    }
                  />
                  <div className="d-flex gap-2 flex-wrap mt-2">
                    <LiberyButton type="button" color="filled" size="small" onClick={() => approve(r.id)}>
                      Approva (OK)
                    </LiberyButton>
                    <LiberyButton type="button" color="outlined" size="small" onClick={() => reject(r.id)}>
                      Rifiuta
                    </LiberyButton>
                  </div>
                </>
              )}
            </MdCard>
          ))}
        </div>
      )}
    </div>
  );
}
