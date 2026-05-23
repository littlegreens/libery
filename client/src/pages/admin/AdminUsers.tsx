import { FormEvent, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { LiberyButton, MdCard, MdTextField } from '@/lib/material/md-react';
import { useMdNativeFormBridge } from '@/lib/useMdNativeFormBridge';

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
  const [msgIsError, setMsgIsError] = useState(false);
  const createFormRef = useRef<HTMLFormElement>(null);
  useMdNativeFormBridge(createFormRef);
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
    setMsgIsError(false);
    try {
      await api.post('/admin/users', form);
      setForm({ email: '', password: '', displayName: '', role: 'user' });
      setMsg('Utente creato');
      load();
    } catch {
      setMsgIsError(true);
      setMsg('Errore creazione utente');
    }
  }

  async function toggleActive(id: string, isActive: boolean) {
    await api.put(`/admin/users/${id}/status`, { isActive: !isActive });
    load();
  }

  async function changeRole(id: string, role: string) {
    setMsg('');
    setMsgIsError(false);
    try {
      await api.put(`/admin/users/${id}/role`, { role });
      setMsg('Ruolo aggiornato');
      load();
    } catch {
      setMsgIsError(true);
      setMsg('Solo admin può cambiare ruoli; responsabile richiede un punto assegnato');
    }
  }

  function tf(patch: Partial<typeof form>) {
    setForm((f) => ({ ...f, ...patch }));
  }

  return (
    <div>
      <h1 className="h4 fw-bold mb-4">Utenti</h1>

      <MdCard type="elevated" className="mb-4" style={{ padding: '1rem' }}>
        <h2 className="h6 fw-bold mb-3">Nuovo utente</h2>
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
              label="Email"
              type="email"
              value={form.email}
              required
              style={{ width: '100%' }}
              onInput={(e: Event) => tf({ email: (e.currentTarget as HTMLElement & { value: string }).value })}
            />
          </div>
          <div className="libery-admin-field">
            <MdTextField
              label="Password"
              type="password"
              value={form.password}
              required
              style={{ width: '100%' }}
              onInput={(e: Event) => tf({ password: (e.currentTarget as HTMLElement & { value: string }).value })}
            />
          </div>
          <div className="libery-admin-field">
            <MdTextField
              label="Nome"
              type="text"
              value={form.displayName}
              style={{ width: '100%' }}
              onInput={(e: Event) => tf({ displayName: (e.currentTarget as HTMLElement & { value: string }).value })}
            />
          </div>
          <div className="libery-admin-field" style={{ minWidth: '9rem', flexBasis: '9rem' }}>
            <label className="small d-block mb-1 text-muted" htmlFor="admin-user-role">
              Ruolo
            </label>
            <select
              id="admin-user-role"
              className="libery-select"
              value={form.role}
              onChange={(e) => tf({ role: e.target.value })}
            >
              <option value="user">Utente</option>
              <option value="point_staff">Addetto</option>
              <option value="point_manager">Responsabile</option>
              <option value="admin">Admin</option>
            </select>
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
          placeholder="Email o nome…"
          style={{ flex: '1 1 12rem', minWidth: '12rem', maxWidth: '24rem' }}
          value={q}
          onInput={(e: Event) => setQ((e.currentTarget as HTMLElement & { value: string }).value)}
        />
        <div className="mt-3">
          <LiberyButton type="button" color="outlined" size="small" onClick={load}>
            Cerca
          </LiberyButton>
        </div>
      </div>

      <div className="table-responsive">
        <table className="libery-table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Nome</th>
              <th>Ruolo</th>
              <th>Libri extra</th>
              <th>Stato</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.email}</td>
                <td>{u.displayName ?? '—'}</td>
                <td>
                  <select
                    className="libery-select libery-select--compact"
                    value={u.role}
                    onChange={(e) => void changeRole(u.id, e.target.value)}
                    aria-label={`Ruolo ${u.email}`}
                  >
                    <option value="user">user</option>
                    <option value="point_staff">point_staff</option>
                    <option value="point_manager">point_manager</option>
                    <option value="admin">admin</option>
                  </select>
                </td>
                <td>{u.libriExtra}</td>
                <td>{u.isActive ? 'Attivo' : 'Sospeso'}</td>
                <td>
                  <LiberyButton
                    type="button"
                    color="outlined"
                    size="small"
                    onClick={() => toggleActive(u.id, u.isActive)}
                  >
                    {u.isActive ? 'Sospendi' : 'Riattiva'}
                  </LiberyButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
