import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { icons } from '@/lib/assets';
import AuthBottomSheet from '@/components/AuthBottomSheet';
import BrandLogo from '@/components/BrandLogo';
import LiberyIcon from '@/components/LiberyIcon';
import CameraFab from '@/components/CameraFab';
import CameraFlow from '@/components/CameraFlow';
import UserAvatar from '@/components/UserAvatar';
import ToastContainer from '@/components/ToastContainer';
import { useAuthStore } from '@/stores/authStore';
import { useLocationStore } from '@/stores/locationStore';

const baseNavItems = [
  { to: '/home', label: 'Home', end: true },
  { to: '/mappa', label: 'Mappa' },
  { to: '/libri', label: 'Libri' },
  { to: '/zaino', label: 'Zaino' },
];

export type LeaveBackpackBook = {
  isbn: string;
  title: string;
  author: string | null;
  id: string;
};

export type ShellOutletContext = {
  openAuthSheet: (mode?: 'login' | 'register') => void;
  goToMap: () => void;
  openLeaveFromBackpack: (book: LeaveBackpackBook) => void;
};

export default function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const isHome = location.pathname === '/';
  const isMap = location.pathname === '/mappa';
  const contextPointId = useMemo(() => {
    const m = location.pathname.match(/^\/punto\/([^/]+)/);
    return m?.[1] ?? null;
  }, [location.pathname]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [leaveBackpackBook, setLeaveBackpackBook] = useState<LeaveBackpackBook | null>(null);
  const [authSheetOpen, setAuthSheetOpen] = useState(false);
  const [authSheetMode, setAuthSheetMode] = useState<'login' | 'register'>('login');
  const loggedIn = useAuthStore((s) => s.isLoggedIn());
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const navItems = [
    ...baseNavItems,
    ...(user?.role === 'point_manager'
      ? [{ to: '/gestore', label: 'Il mio punto', end: true }]
      : []),
    ...(user?.role === 'admin' ? [{ to: '/admin', label: 'Dashboard', end: true }] : []),
  ];

  function openAuthSheet(mode: 'login' | 'register' = 'login') {
    setAuthSheetMode(mode);
    setAuthSheetOpen(true);
    setMenuOpen(false);
  }

  function goToMap() {
    setMenuOpen(false);
    navigate('/mappa');
  }

  function handleLogout() {
    logout();
    setMenuOpen(false);
    navigate('/');
  }

  useEffect(() => {
    setMenuOpen(false);
    setAuthSheetOpen(false);
    setCameraOpen(false);
    setLeaveBackpackBook(null);
    document.body.style.overflow = '';
  }, [location.pathname]);

  // Geolocalizzazione globale: avvia un watch unico per tutta la sessione.
  // Il prompt del browser viene chiesto al primo mount; le pagine leggono
  // la posizione dal locationStore senza richiederla nuovamente.
  useEffect(() => {
    const { startWatch, stopWatch } = useLocationStore.getState();
    startWatch();
    return () => {
      stopWatch();
    };
  }, []);

  useEffect(() => {
    if (isHome && !loggedIn) return;
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen, isHome, loggedIn]);

  const shellClass = [
    'app-shell',
    'd-flex',
    'flex-column',
    isHome ? 'app-shell--home' : '',
    isMap ? 'app-shell--map' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const showHeader = loggedIn || !isHome;
  const headerMinimal = isHome && loggedIn;

  function openLeaveFromBackpack(book: LeaveBackpackBook) {
    setLeaveBackpackBook(book);
    setCameraOpen(true);
  }

  const outletContext: ShellOutletContext = { openAuthSheet, goToMap, openLeaveFromBackpack };

  return (
    <div className={shellClass}>
      {showHeader && (
        <header
          className={`app-header d-flex align-items-center px-3 py-2 gap-2 ${headerMinimal ? 'app-header--minimal' : ''}`}
        >
          <button
            type="button"
            className="btn btn-menu"
            onClick={() => setMenuOpen(true)}
            aria-label="Apri menu"
          >
            <LiberyIcon src={icons.menu} width={28} height={28} />
          </button>
          {!headerMinimal && (
            <Link to="/" className="app-header-logo" onClick={() => setMenuOpen(false)}>
              <BrandLogo className="header-logo" />
            </Link>
          )}
          <div className="flex-grow-1" aria-hidden />
          {loggedIn && user ? (
            <UserAvatar user={user} onClick={() => navigate('/profilo')} />
          ) : (
            <button type="button" className="btn-entra-header" onClick={() => openAuthSheet('login')}>
              Entra
            </button>
          )}
        </header>
      )}

      <main
        className={[
          'app-main flex-grow-1',
          isMap ? 'app-main--map' : '',
          loggedIn && !isMap ? 'app-main--with-fab' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <Outlet context={outletContext} />
      </main>

      {loggedIn && <CameraFab onClick={() => setCameraOpen(true)} />}
      <CameraFlow
        open={cameraOpen}
        onClose={() => {
          setCameraOpen(false);
          setLeaveBackpackBook(null);
        }}
        contextPointId={leaveBackpackBook ? null : contextPointId}
        leaveBackpackBook={leaveBackpackBook}
      />

      <AuthBottomSheet
        open={authSheetOpen}
        onClose={() => setAuthSheetOpen(false)}
        initialMode={authSheetMode}
        onSuccess={() => navigate('/mappa')}
      />

      {menuOpen && (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Chiudi menu"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <aside className={`libery-sidebar ${menuOpen ? 'open' : ''}`}>
        <div className="libery-sidebar-header d-flex align-items-center justify-content-between">
          <span className="fw-bold">Menu</span>
          <button type="button" className="btn-close" aria-label="Chiudi" onClick={() => setMenuOpen(false)} />
        </div>
        <nav className="libery-sidebar-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `libery-nav-link ${isActive ? 'active' : ''}`}
              onClick={() => setMenuOpen(false)}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="libery-sidebar-footer">
          {loggedIn ? (
            <>
              <p className="small text-muted mb-3 text-truncate">{user?.displayName ?? user?.email}</p>
              <button type="button" className="libery-nav-link libery-logout w-100 text-start" onClick={handleLogout}>
                Esci
              </button>
            </>
          ) : (
            <>
              <button type="button" className="btn btn-sm btn-libery w-100 mb-2" onClick={() => openAuthSheet('login')}>
                Accedi
              </button>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary w-100"
                onClick={() => openAuthSheet('register')}
              >
                Registrati
              </button>
            </>
          )}
        </div>
      </aside>

      <ToastContainer />
    </div>
  );
}
