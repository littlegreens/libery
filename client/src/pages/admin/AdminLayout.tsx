import { Link, Outlet, Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useAuthHydrated } from '@/hooks/useAuthHydrated';
import LiberyLoading from '@/components/LiberyLoading';
import { LiberyButton, MdNavigateButton } from '@/lib/material/md-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

const nav = [
  { to: '/admin', end: true, label: 'Dashboard' },
  { to: '/admin/richieste', label: 'Richieste punti' },
  { to: '/admin/punti', label: 'Punti' },
  { to: '/admin/utenti', label: 'Utenti' },
];

function isNavActive(pathname: string, to: string, end?: boolean) {
  if (end) return pathname === to;
  return pathname === to || pathname.startsWith(`${to}/`);
}

export default function AdminLayout() {
  useDocumentTitle('Admin');
  const location = useLocation();
  const hydrated = useAuthHydrated();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  if (!hydrated) {
    return (
      <div className="admin-layout min-vh-100 d-flex align-items-center justify-content-center">
        <LiberyLoading variant="page" label="Caricamento…" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/home" replace state={{ from: location.pathname }} />;
  }

  if (user.role !== 'admin') {
    return <Navigate to="/mappa" replace />;
  }

  return (
    <div className="admin-layout min-vh-100">
      <nav className="admin-nav px-3 py-2 d-flex flex-wrap align-items-center gap-2" aria-label="Admin">
        <MdNavigateButton to="/home" color="text" size="small">
          ← App
        </MdNavigateButton>
        <Link
          to="/admin"
          className="text-decoration-none fw-bold"
          style={{ color: 'var(--md-sys-color-on-surface)' }}
        >
          Admin
        </Link>
        {nav.map((item) => (
          <MdNavigateButton
            key={item.to}
            to={item.to}
            color={isNavActive(location.pathname, item.to, item.end) ? 'filled' : 'outlined'}
            size="small"
          >
            {item.label}
          </MdNavigateButton>
        ))}
        <LiberyButton type="button" color="text" size="small" className="ms-auto" onClick={() => logout()}>
          Logout
        </LiberyButton>
      </nav>
      <div className="libery-container py-4">
        <Outlet />
      </div>
    </div>
  );
}
