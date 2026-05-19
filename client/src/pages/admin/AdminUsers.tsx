import { FormEvent, useEffect, useState } from 'react';
import { api } from '@/lib/api';

type UserRow = {
  id: string;
  email: string;
  displayName: string | null;
  role: string;
  libriExtra: number;
  libriOggiUsed: number;
  isActive: boolean;
};

export default function AdminUsers() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [q, setQ] = useState('');
  const [msg, setMsg] = useState('');
  const [form, setForm] = useState({
    email: '',
    password: '',
    displayName: '',
    role: 'user',
  });

  async function load() {
    const { data } = await api.get('/admin/users', { params: { q: q || undefined } });
    setUsers(data.users);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setMsg('');
    try {
      await api.post('/admin/users', form);
      setForm({ email: '', password: '', displayName: '', role: 'user' });
      setMsg('Utente creato');
      load();
    } catch {
      setMsg('Errore creazione utente');
    }
  }

  async function toggleActive(id: string, isActive: boolean) {
    await api.put(`/admin/users/${id}/status`, { isActive: !isActive });
    load();
  }

  return (
    <div>
      <h1 className="h4 fw-bold mb-4">Utenti</h1>

      <div className="card border-0 shadow-sm mb-4">
        <div className="card-body">
          <h2 className="h6 fw-bold mb-3">Nuovo utente</h2>
          {msg && <div className="alert alert-success py-2 small">{msg}</div>}
          <form className="row g-2" onSubmit={handleCreate}>
            <div className="col-md-3">
              <input
                className="form-control form-control-sm"
                placeholder="Email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>
            <div className="col-md-2">
              <input
                className="form-control form-control-sm"
                placeholder="Password"
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
              />
            </div>
            <div className="col-md-2">
              <input
                className="form-control form-control-sm"
                placeholder="Nome"
                value={form.displayName}
                onChange={(e) => setForm({ ...form, displayName: e.target.value })}
              />
            </div>
            <div className="col-md-2">
              <select
                className="form-select form-select-sm"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              >
                <option value="user">Utente</option>
                <option value="point_manager">Responsabile</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="col-md-2">
              <button type="submit" className="btn btn-sm btn-libery w-100">
                Crea
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="d-flex gap-2 mb-3">
        <input
          className="form-control form-control-sm"
          placeholder="Cerca email o nome…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={load}>
          Cerca
        </button>
      </div>

      <div className="table-responsive">
        <table className="table table-sm align-middle bg-white shadow-sm">
          <thead>
            <tr>
              <th>Email</th>
              <th>Nome</th>
              <th>Ruolo</th>
              <th>Libri extra</th>
              <th>Stato</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.email}</td>
                <td>{u.displayName ?? '—'}</td>
                <td>
                  <span className="badge text-bg-light">{u.role}</span>
                </td>
                <td>{u.libriExtra}</td>
                <td>{u.isActive ? 'Attivo' : 'Sospeso'}</td>
                <td>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    onClick={() => toggleActive(u.id, u.isActive)}
                  >
                    {u.isActive ? 'Sospendi' : 'Riattiva'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
