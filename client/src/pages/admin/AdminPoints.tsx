import { FormEvent, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { LiberyButton, MdCard, MdTextField } from '@/lib/material/md-react';
import { useMdNativeFormBridge } from '@/lib/useMdNativeFormBridge';

type PointRow = {
  id: string;
  name: string;
  type: string;
  status: string;
  city: string | null;
  setupCompleted: boolean;
  manager: { email: string; displayName: string | null } | null;
};

export default function AdminPoints() {
  const [points, setPoints] = useState<PointRow[]>([]);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [msg, setMsg] = useState('');
  const [msgIsError, setMsgIsError] = useState(false);

  const createFormRef = useRef<HTMLFormElement>(null);
  useMdNativeFormBridge(createFormRef);

  const [create, setCreate] = useState({
    name: '',
    type: 'biblioteca',
    city: '',
    address: '',
    managerEmail: '',
  });

  async function load() {
    const { data } = await api.get('/admin/points', {
      params: {
        q: q || undefined,
        status: statusFilter || undefined,
      },
    });
    setPoints(data.points);
  }

  useEffect(() => {
    load();
  }, []);

  function cf(patch: Partial<typeof create>) {
    setCreate((c) => ({ ...c, ...patch }));
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setMsg('');
    setMsgIsError(false);
    try {
      await api.post('/admin/points', {
        name: create.name.trim(),
        type: create.type,
        city: create.city.trim() || undefined,
        address: create.address.trim() || undefined,
        managerEmail: create.managerEmail.trim() || undefined,
      });
      setCreate({ name: '', type: 'biblioteca', city: '', address: '', managerEmail: '' });
      setMsg('Punto creato e approvato');
      load();
    } catch {
      setMsgIsError(true);
      setMsg('Errore creazione punto');
    }
  }

  async function setStatus(id: string, status: string) {
    await api.put(`/admin/points/${id}/status`, { status });
    load();
  }

  return (
    <div>
      <h1 className="h4 fw-bold mb-4">Punti</h1>

      <MdCard type="elevated" className="mb-4" style={{ padding: '1rem' }}>
        <h2 className="h6 fw-bold mb-3">Nuovo punto (approvato)</h2>
        {msg && (
          <div
            className={`small libery-inline-alert mb-3 ${
              msgIsError ? 'libery-inline-alert-error' : 'libery-inline-alert-success'
            }`}
          >
            {msg}
          </div>
        )}
        <form ref={createFormRef} className="libery-admin-fields mb-3" onSubmit={handleCreate}>
          <div className="libery-admin-field">
            <MdTextField
              label="Nome"
              type="text"
              required
              value={create.name}
              style={{ width: '100%' }}
              onInput={(e: Event) => cf({ name: (e.currentTarget as HTMLElement & { value: string }).value })}
            />
          </div>
          <div className="libery-admin-field" style={{ minWidth: '10rem', flexBasis: '10rem' }}>
            <label className="small d-block mb-1 text-muted" htmlFor="new-point-type">
              Tipo
            </label>
            <select
              id="new-point-type"
              className="libery-select"
              value={create.type}
              required
              onChange={(e) => cf({ type: e.target.value })}
            >
              <option value="biblioteca">Biblioteca</option>
              <option value="libreria">Libreria</option>
              <option value="corner_free">Corner Free</option>
            </select>
          </div>
          <div className="libery-admin-field">
            <MdTextField
              label="Città"
              type="text"
              value={create.city}
              style={{ width: '100%' }}
              onInput={(e: Event) => cf({ city: (e.currentTarget as HTMLElement & { value: string }).value })}
            />
          </div>
          <div className="libery-admin-field">
            <MdTextField
              label="Indirizzo"
              type="text"
              value={create.address}
              style={{ width: '100%' }}
              onInput={(e: Event) => cf({ address: (e.currentTarget as HTMLElement & { value: string }).value })}
            />
          </div>
          <div className="libery-admin-field">
            <MdTextField
              label="Email gestore"
              type="email"
              value={create.managerEmail}
              style={{ width: '100%' }}
              onInput={(e: Event) =>
                cf({ managerEmail: (e.currentTarget as HTMLElement & { value: string }).value })
              }
            />
          </div>
          <LiberyButton
            type="button"
            color="filled"
            size="small"
            style={{ alignSelf: 'stretch' }}
            onClick={() => createFormRef.current?.requestSubmit()}
          >
            Crea
          </LiberyButton>
        </form>
      </MdCard>

      <div className="d-flex flex-wrap gap-2 mb-3 align-items-start">
        <MdTextField
          label="Cerca"
          type="search"
          style={{ flex: '1 1 10rem', minWidth: '10rem', maxWidth: '240px' }}
          placeholder="Nome, città…"
          value={q}
          onInput={(e: Event) => setQ((e.currentTarget as HTMLElement & { value: string }).value)}
        />
        <div style={{ minWidth: '10rem', maxWidth: '200px', flex: '0 1 12rem', marginTop: '1.15rem' }}>
          <label className="small d-block mb-1 text-muted visually-hidden" htmlFor="pt-status-filter">
            Stato
          </label>
          <select
            id="pt-status-filter"
            className="libery-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">Tutti gli stati</option>
            <option value="approved">Approvati</option>
            <option value="pending">In attesa</option>
            <option value="suspended">Sospesi</option>
          </select>
        </div>
        <div className="mt-3">
          <LiberyButton type="button" color="outlined" size="small" onClick={load}>
            Filtra
          </LiberyButton>
        </div>
      </div>

      <div className="table-responsive">
        <table className="libery-table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Tipo</th>
              <th>Città</th>
              <th>Stato</th>
              <th>Setup</th>
              <th>Gestore</th>
              <th>Azioni</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td>{p.type}</td>
                <td>{p.city ?? '—'}</td>
                <td>
                  <span className="libery-badge">{p.status}</span>
                </td>
                <td>{p.setupCompleted ? '✓' : '—'}</td>
                <td className="small">{p.manager?.email ?? '—'}</td>
                <td>
                  <div className="d-flex gap-2 flex-wrap">
                    {p.status !== 'approved' && (
                      <LiberyButton type="button" color="filled" size="small" onClick={() => setStatus(p.id, 'approved')}>
                        OK
                      </LiberyButton>
                    )}
                    {p.status !== 'suspended' && (
                      <LiberyButton
                        type="button"
                        color="outlined"
                        size="small"
                        onClick={() => setStatus(p.id, 'suspended')}
                      >
                        Sospendi
                      </LiberyButton>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
