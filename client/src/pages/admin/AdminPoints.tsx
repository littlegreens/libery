import { FormEvent, useEffect, useState } from 'react';
import { api } from '@/lib/api';

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

  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setMsg('');
    try {
      await api.post('/admin/points', {
        name: fd.get('name'),
        type: fd.get('type'),
        city: fd.get('city') || undefined,
        address: fd.get('address') || undefined,
        managerEmail: fd.get('managerEmail') || undefined,
        managerPassword: fd.get('managerPassword') || undefined,
      });
      e.currentTarget.reset();
      setMsg('Punto creato e approvato');
      load();
    } catch {
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

      <div className="card border-0 shadow-sm mb-4">
        <div className="card-body">
          <h2 className="h6 fw-bold mb-3">Nuovo punto (approvato)</h2>
          {msg && <div className="alert alert-success py-2 small">{msg}</div>}
          <form className="row g-2" onSubmit={handleCreate}>
            <div className="col-md-2">
              <input name="name" className="form-control form-control-sm" placeholder="Nome" required />
            </div>
            <div className="col-md-2">
              <select name="type" className="form-select form-select-sm" required defaultValue="biblioteca">
                <option value="biblioteca">Biblioteca</option>
                <option value="libreria">Libreria</option>
                <option value="corner_free">Corner Free</option>
              </select>
            </div>
            <div className="col-md-2">
              <input name="city" className="form-control form-control-sm" placeholder="Città" />
            </div>
            <div className="col-md-2">
              <input name="address" className="form-control form-control-sm" placeholder="Indirizzo" />
            </div>
            <div className="col-md-2">
              <input
                name="managerEmail"
                type="email"
                className="form-control form-control-sm"
                placeholder="Email gestore"
              />
            </div>
            <div className="col-md-2">
              <button type="submit" className="btn btn-sm btn-libery w-100">
                Crea
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="d-flex flex-wrap gap-2 mb-3">
        <input
          className="form-control form-control-sm"
          style={{ maxWidth: 200 }}
          placeholder="Cerca…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="form-select form-select-sm"
          style={{ maxWidth: 160 }}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">Tutti gli stati</option>
          <option value="approved">Approvati</option>
          <option value="pending">In attesa</option>
          <option value="suspended">Sospesi</option>
        </select>
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={load}>
          Filtra
        </button>
      </div>

      <div className="table-responsive">
        <table className="table table-sm align-middle bg-white shadow-sm">
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
                  <span className="badge text-bg-light">{p.status}</span>
                </td>
                <td>{p.setupCompleted ? '✓' : '—'}</td>
                <td className="small">{p.manager?.email ?? '—'}</td>
                <td className="d-flex gap-1 flex-wrap">
                  {p.status !== 'approved' && (
                    <button
                      type="button"
                      className="btn btn-sm btn-success"
                      onClick={() => setStatus(p.id, 'approved')}
                    >
                      OK
                    </button>
                  )}
                  {p.status !== 'suspended' && (
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-danger"
                      onClick={() => setStatus(p.id, 'suspended')}
                    >
                      Sospendi
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
