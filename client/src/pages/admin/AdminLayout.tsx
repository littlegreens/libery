import { Link, NavLink, Outlet, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

const nav = [
  { to: '/admin', end: true, label: 'Dashboard' },
  { to: '/admin/richieste', label: 'Richieste punti' },
  { to: '/admin/punti', label: 'Punti' },
  { to: '/admin/utenti', label: 'Utenti' },
];

export default function AdminLayout() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  if (!user || user.role !== 'admin') {
    return <Navigate to="/entra" replace />;
  }

  return (
    <div className="admin-layout min-vh-100">
      <nav className="admin-nav border-bottom bg-white px-3 py-2 d-flex flex-wrap align-items-center gap-2">
        <Link to="/" className="fw-bold text-decoration-none text-dark me-2">
          Libery Admin
        </Link>
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `btn btn-sm ${isActive ? 'btn-libery' : 'btn-outline-secondary'}`
            }
          >
            {item.label}
          </NavLink>
        ))}
        <button type="button" className="btn btn-sm btn-link ms-auto" onClick={logout}>
          Esci
        </button>
      </nav>
      <div className="container py-4">
        <Outlet />
      </div>
    </div>
  );
}
