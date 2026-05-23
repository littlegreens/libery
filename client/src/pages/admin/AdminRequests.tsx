import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { getApiError } from '@/lib/apiError';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { LiberyButton, MdCard, MdTextField } from '@/lib/material/md-react';
import { toast } from '@/stores/toastStore';

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
  useDocumentTitle('Richieste punti admin');
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [filter, setFilter] = useState('pending');
  const [note, setNote] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/admin/requests', { params: { status: filter } });
      setRequests(data.requests);
    } catch (err) {
      toast.error(getApiError(err, 'Caricamento richieste non riuscito'));
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  async function approve(id: string) {
    try {
      const { data } = await api.post(`/admin/requests/${id}/approve`, {
        adminNote: note[id],
        managerEmail: note[`${id}-email`] || undefined,
      });
      const creds = data.managerCredentials;
      toast.success(
        creds
          ? `Approvato. Gestore: ${creds.email} / password temporanea: ${creds.temporaryPassword}`
          : 'Richiesta approvata',
        { duration: creds ? 10000 : 4000 },
      );
      void load();
    } catch (err) {
      toast.error(getApiError(err, 'Approvazione non riuscita — verifica email gestore'));
    }
  }

  async function reject(id: string) {
    const adminNote = note[id];
    if (!adminNote?.trim()) {
      toast.warning('Inserisci una nota per il rifiuto');
      return;
    }
    try {
      await api.post(`/admin/requests/${id}/reject`, { adminNote });
      toast.success('Richiesta rifiutata');
      void load();
    } catch (err) {
      toast.error(getApiError(err, 'Rifiuto non riuscito'));
    }
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

      {requests.length === 0 ? (
        <p className="text-muted" role="status">
          Nessuna richiesta in questa categoria.
        </p>
      ) : (
        <div className="d-flex flex-column gap-3">
          {requests.map((r) => (
            <MdCard key={r.id} type="elevated" style={{ padding: '1rem' }}>
              <div className="d-flex justify-content-between flex-wrap gap-2 mb-2">
                <div>
                  <h2 className="h6 fw-bold mb-1">{r.name}</h2>
                  <p className="small text-muted mb-0">
                    {r.pointType} · {r.city ?? '—'} ·{' '}
                    {new Date(r.createdAt).toLocaleDateString('it-IT')}
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
                    <LiberyButton type="button" color="filled" size="small" onClick={() => void approve(r.id)}>
                      Approva
                    </LiberyButton>
                    <LiberyButton type="button" color="outlined" size="small" onClick={() => void reject(r.id)}>
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
