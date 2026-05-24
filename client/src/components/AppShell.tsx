import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { withAvatarCacheBust } from '@/lib/avatarUrl';
import { useAuthHydrated } from '@/hooks/useAuthHydrated';
import AuthBottomSheet from '@/components/AuthBottomSheet';
import BrandLogo from '@/components/BrandLogo';
import CameraFab from '@/components/CameraFab';
import CameraFlow from '@/components/CameraFlow';
import LiberyContextualTopBar, {
  type LiberyContextualTopBarConfig,
} from '@/components/LiberyContextualTopBar';
import UserAvatar from '@/components/UserAvatar';
import { avatarSlotBadgeValue } from '@/lib/slotsDisplay';
import { useAuthStore } from '@/stores/authStore';
import { useLocationStore } from '@/stores/locationStore';
import { useSlotsStore } from '@/stores/slotsStore';

/** Voci drawer: ospite = solo queste; utente loggato vede anche zaino (+ ruoli in overflow / eventuali voci dedicate). */
const GUEST_NAV_ITEMS = [
  { to: '/home', label: 'Home', icon: 'home', end: true },
  { to: '/mappa', label: 'Mappa', icon: 'explore', end: false },
  { to: '/libri', label: 'Libri', icon: 'menu_book', end: false },
] as const;

const LOGGED_NAV_EXTRA = [{ to: '/zaino', label: 'Zaino', icon: 'backpack', end: false }] as const;

const ROLE_NAV_ITEMS = {
  admin: { to: '/admin', label: 'Dashboard', icon: 'dashboard', end: false },
  point_manager: { to: '/gestore', label: 'Il mio punto', icon: 'storefront', end: false },
  point_staff: { to: '/gestore', label: 'Scan addetto', icon: 'qr_code_scanner', end: false },
} as const;

export type LeaveBackpackBook = {
  isbn: string;
  title: string;
  author: string | null;
  id: string;
};

export type ShellPageBarConfig = LiberyContextualTopBarConfig;

export type PointTakeBookPayload = {
  id: string;
  isbn: string;
  title: string;
  author: string | null;
  coverPath?: string | null;
};

export type ShellOutletContext = {
  openAuthSheet: (mode?: 'login' | 'register') => void;
  goToMap: () => void;
  openLeaveFromBackpack: (book: LeaveBackpackBook) => void;
  setPageBar: (config: ShellPageBarConfig | null) => void;
  /** Registrato da PointPage: apre il flusso «Ritira» dopo scan in biblioteca/libreria. */
  setPointTakeHandler: (handler: ((book: PointTakeBookPayload) => void) | null) => void;
  /** Riapre la fotocamera (es. ritorno da scheda libro dopo scansione). */
  reopenCamera: () => void;
};

function pathMatches(navTo: string, end: boolean, pathname: string): boolean {
  if (end) return pathname === navTo;
  return pathname === navTo || pathname.startsWith(`${navTo}/`);
}

export default function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const pathname = location.pathname;

  const isHome = pathname === '/';
  const isSplash = pathname === '/';
  const isWelcome = pathname === '/home';
  const isMap = pathname === '/mappa';
  const contextPointId = useMemo(() => {
    const m = pathname.match(/^\/punto\/([^/]+)/);
    return m?.[1] ?? null;
  }, [pathname]);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [overflowMenuOpen, setOverflowMenuOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [leaveBackpackBook, setLeaveBackpackBook] = useState<LeaveBackpackBook | null>(null);
  const [authSheetOpen, setAuthSheetOpen] = useState(false);
  const [authSheetMode, setAuthSheetMode] = useState<'login' | 'register'>('login');
  const [pageBar, setPageBar] = useState<ShellPageBarConfig | null>(null);

  const hydrated = useAuthHydrated();
  const loggedIn = useAuthStore((s) => s.isLoggedIn());
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const setAuth = useAuthStore((s) => s.setAuth);
  const logout = useAuthStore((s) => s.logout);

  /** Sessioni salvate prima del fix login: ricarica avatar da `/auth/me`. */
  useEffect(() => {
    if (!hydrated || !accessToken || !user || user.avatarUrl) return;
    let cancelled = false;
    api
      .get('/auth/me')
      .then(({ data }) => {
        if (cancelled) return;
        const u = data.user;
        if (!u?.avatarUrl) return;
        setAuth({
          accessToken,
          refreshToken: refreshToken ?? '',
          user: { ...user, avatarUrl: withAvatarCacheBust(u.avatarUrl) },
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [hydrated, accessToken, user, refreshToken, setAuth]);
  const slotsFree = useSlotsStore((s) => s.slots?.slotsFree);
  const refreshSlots = useSlotsStore((s) => s.refreshSlots);

  const overflowMenuRef = useRef<HTMLElement & { open?: boolean }>(null);
  const pointTakeHandlerRef = useRef<((book: PointTakeBookPayload) => void) | null>(null);
  /** Evita di chiudere la fotocamera al cambio route quando si torna dalla scheda libro. */
  const skipCameraCloseOnNavRef = useRef(false);

  const setPointTakeHandler = useCallback((handler: ((book: PointTakeBookPayload) => void) | null) => {
    pointTakeHandlerRef.current = handler;
  }, []);

  const drawerNavItems = useMemo(() => {
    const base = loggedIn ? [...GUEST_NAV_ITEMS, ...LOGGED_NAV_EXTRA] : [...GUEST_NAV_ITEMS];
    return [
      ...base,
      ...(loggedIn && user?.role === 'admin' ? [ROLE_NAV_ITEMS.admin] : []),
      ...(loggedIn && user?.role === 'point_manager' ? [ROLE_NAV_ITEMS.point_manager] : []),
      ...(loggedIn && user?.role === 'point_staff' ? [ROLE_NAV_ITEMS.point_staff] : []),
    ];
  }, [loggedIn, user?.role]);

  const openAuthSheet = useCallback((mode: 'login' | 'register' = 'login') => {
    setAuthSheetMode(mode);
    setAuthSheetOpen(true);
    setDrawerOpen(false);
    setOverflowMenuOpen(false);
  }, []);

  const goToMap = useCallback(() => {
    setDrawerOpen(false);
    navigate('/mappa');
  }, [navigate]);

  const reopenCamera = useCallback(() => {
    skipCameraCloseOnNavRef.current = true;
    setCameraOpen(true);
  }, []);

  const openLeaveFromBackpack = useCallback((book: LeaveBackpackBook) => {
    setLeaveBackpackBook(book);
    setCameraOpen(true);
  }, []);

  function handleLogout() {
    logout();
    setDrawerOpen(false);
    setOverflowMenuOpen(false);
    navigate('/home');
  }

  useEffect(() => {
    setDrawerOpen(false);
    setOverflowMenuOpen(false);
    setAuthSheetOpen(false);
    if (!skipCameraCloseOnNavRef.current) {
      setCameraOpen(false);
      setLeaveBackpackBook(null);
    }
    skipCameraCloseOnNavRef.current = false;
    setPageBar(null);
    document.body.style.overflow = '';
  }, [pathname]);

  useEffect(() => {
    const menu = overflowMenuRef.current;
    if (!menu) return;
    const onClosed = () => setOverflowMenuOpen(false);
    menu.addEventListener('closed', onClosed);
    return () => menu.removeEventListener('closed', onClosed);
  }, []);

  /** Sincronizza `open` sulla proprietà Lit (oltre all'attributo React). */
  useEffect(() => {
    const menu = overflowMenuRef.current;
    if (menu && 'open' in menu) menu.open = overflowMenuOpen;
  }, [overflowMenuOpen]);

  useEffect(() => {
    if (isHome && !loggedIn) return;
    document.body.style.overflow = drawerOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [drawerOpen, isHome, loggedIn]);

  useEffect(() => {
    const { startWatch, stopWatch } = useLocationStore.getState();
    startWatch();
    return () => stopWatch();
  }, []);

  useEffect(() => {
    if (loggedIn) void refreshSlots();
    else useSlotsStore.setState({ slots: null });
  }, [loggedIn, pathname, refreshSlots]);

  const shellClass = [
    'app-shell',
    'd-flex',
    'flex-column',
    isSplash ? 'app-shell--splash' : '',
    isMap ? 'app-shell--map' : '',
    isWelcome ? 'app-shell--welcome' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const showHeader = !isSplash;
  const headerMinimal = isHome && loggedIn;

  const onNavListClick = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      const path = e.nativeEvent.composedPath();
      for (const node of path) {
        if (!(node instanceof HTMLElement)) continue;
        if (node.tagName.toLowerCase() !== 'md-list-item') continue;
        const to = node.getAttribute('data-nav-to');
        if (to) {
          setCameraOpen(false);
          setLeaveBackpackBook(null);
          navigate(to);
          setDrawerOpen(false);
        }
        break;
      }
    },
    [navigate],
  );

  function runOverflowAction(fn: () => void) {
    setOverflowMenuOpen(false);
    fn();
  }

  const outletContext = useMemo<ShellOutletContext>(
    () => ({
      openAuthSheet,
      goToMap,
      openLeaveFromBackpack,
      setPageBar,
      setPointTakeHandler,
      reopenCamera,
    }),
    [openAuthSheet, goToMap, openLeaveFromBackpack, setPointTakeHandler, reopenCamera],
  );

  return (
    <div className={shellClass}>
      {showHeader && (
        <div className="app-chrome md-top-app-bar-host">
          <header
            className={`app-header app-header--material md-top-app-bar d-flex align-items-center px-2 py-2 gap-1 ${headerMinimal ? 'app-header--minimal' : ''}`}
          >
            <md-icon-button
              className="shell-icon-btn"
              color="standard"
              aria-label="Apri menu di navigazione"
              onClick={() => {
                setOverflowMenuOpen(false);
                setDrawerOpen(true);
              }}
            >
              <md-icon>menu</md-icon>
            </md-icon-button>

            {!headerMinimal && (
              <Link to="/home" className="app-header-logo" onClick={() => setDrawerOpen(false)}>
                <BrandLogo className="header-logo" />
              </Link>
            )}

            <div className="flex-grow-1" aria-hidden />

            <div className="shell-overflow-wrap position-relative">
              {loggedIn && user ? (
                <UserAvatar
                  user={user}
                  className="shell-header-avatar"
                  slotBadge={
                    slotsFree != null ? avatarSlotBadgeValue(slotsFree) : null
                  }
                  onClick={() => {
                    setDrawerOpen(false);
                    navigate('/profilo');
                  }}
                />
              ) : (
                <>
                  <md-icon-button
                    id="shell-overflow-anchor"
                    className="shell-icon-btn"
                    color="standard"
                    aria-label="Login"
                    onClick={() => setOverflowMenuOpen((o) => !o)}
                  >
                    <md-icon>more_vert</md-icon>
                  </md-icon-button>
                  <md-menu
                    ref={overflowMenuRef as React.RefObject<HTMLElement>}
                    className="libery-action-menu libery-shell-menu"
                    anchor="shell-overflow-anchor"
                    positioning="popover"
                    quick
                    has-overflow
                    anchor-corner="end-start"
                    menu-corner="start-start"
                  >
                    <md-menu-item onClick={() => runOverflowAction(() => openAuthSheet('login'))}>
                      <md-icon slot="start">login</md-icon>
                      <span slot="headline">Login</span>
                    </md-menu-item>
                  </md-menu>
                </>
              )}
            </div>
          </header>
          {pageBar ? <LiberyContextualTopBar config={pageBar} /> : null}
        </div>
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

      {drawerOpen && (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Chiudi menu"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      <aside className={`libery-sidebar libery-sidebar--material ${drawerOpen ? 'open' : ''}`}>
        <div className="libery-sidebar-header d-flex align-items-center justify-content-between gap-2">
          <span className="fw-semibold mb-0">Menu</span>
          <md-icon-button
            color="standard"
            aria-label="Chiudi"
            onClick={() => setDrawerOpen(false)}
          >
            <md-icon>close</md-icon>
          </md-icon-button>
        </div>

        <nav className="libery-sidebar-nav px-2 pb-2" aria-label="Navigazione principale">
          <md-list onClick={onNavListClick}>
            {drawerNavItems.map((item) => {
              const active = pathMatches(item.to, item.end, pathname);
              return (
                <md-list-item
                  key={item.to}
                  type="button"
                  tabIndex={0}
                  data-nav-to={item.to}
                  className={active ? 'shell-nav-item--active' : ''}
                >
                  <md-icon slot="start">{item.icon}</md-icon>
                  <span slot="headline">{item.label}</span>
                </md-list-item>
              );
            })}
          </md-list>
        </nav>

        <div className="libery-sidebar-footer libery-sidebar-footer--material px-2 pb-2">
          <md-list>
            {!loggedIn ? (
              <md-list-item
                type="button"
                tabIndex={0}
                onClick={() => {
                  openAuthSheet('login');
                  setDrawerOpen(false);
                }}
              >
                <md-icon slot="start">login</md-icon>
                <span slot="headline">Login</span>
              </md-list-item>
            ) : (
              <md-list-item type="button" tabIndex={0} onClick={handleLogout}>
                <md-icon slot="start">logout</md-icon>
                <span slot="headline">Logout</span>
              </md-list-item>
            )}
          </md-list>
        </div>
      </aside>

    </div>
  );
}
