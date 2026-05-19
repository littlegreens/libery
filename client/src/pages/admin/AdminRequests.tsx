import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

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

      <div className="mb-3 d-flex gap-2">
        {(['pending', 'approved', 'rejected'] as const).map((s) => (
          <button
            key={s}
            type="button"
            className={`btn btn-sm ${filter === s ? 'btn-libery' : 'btn-outline-secondary'}`}
            onClick={() => setFilter(s)}
          >
            {s === 'pending' ? 'In attesa' : s === 'approved' ? 'Approvate' : 'Rifiutate'}
          </button>
        ))}
      </div>

      {feedback && <div className="alert alert-info py-2 small">{feedback}</div>}

      {requests.length === 0 ? (
        <p className="text-muted">Nessuna richiesta in questa categoria.</p>
      ) : (
        <div className="d-flex flex-column gap-3">
          {requests.map((r) => (
            <div key={r.id} className="card border-0 shadow-sm">
              <div className="card-body">
                <div className="d-flex justify-content-between flex-wrap gap-2 mb-2">
                  <div>
                    <h2 className="h6 fw-bold mb-1">{r.name}</h2>
                    <p className="small text-muted mb-0">
                      {r.pointType} · {r.city ?? '—'} · {new Date(r.createdAt).toLocaleDateString('it-IT')}
                    </p>
                  </div>
                  <span className="badge text-bg-light align-self-start">{r.status}</span>
                </div>
                <p className="small mb-2">
                  Richiedente: {r.requester.displayName ?? r.requester.email}
                  {r.contactEmail && ` · Contatto: ${r.contactEmail}`}
                </p>
                {r.status === 'pending' && (
                  <>
                    <input
                      className="form-control form-control-sm mb-2"
                      placeholder="Email gestore (se diversa dal contatto)"
                      value={note[`${r.id}-email`] ?? ''}
                      onChange={(e) => setNote({ ...note, [`${r.id}-email`]: e.target.value })}
                    />
                    <input
                      className="form-control form-control-sm mb-2"
                      placeholder="Nota admin (obbligatoria per rifiuto)"
                      value={note[r.id] ?? ''}
                      onChange={(e) => setNote({ ...note, [r.id]: e.target.value })}
                    />
                    <div className="d-flex gap-2">
                      <button type="button" className="btn btn-sm btn-success" onClick={() => approve(r.id)}>
                        Approva (OK)
                      </button>
                      <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => reject(r.id)}>
                        Rifiuta
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
