import { Link, useLocation } from 'react-router-dom';

function ChevronLeftIcon() {
  return (
    <svg
      className="book-page-back-icon"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

/**
 * Back link contestuale:
 *  - se la rotta corrente è stata raggiunta tramite un <Link state={{ from: ... }}>
 *    usa quel target (path + label dedicata)
 *  - altrimenti fallback a /mappa
 *
 * Convenzione: chi naviga verso una pagina di dettaglio passa:
 *   navigate('/libro/123', { state: { from: { to: location.pathname, label: 'Torna ...' } } })
 *
 * Oppure più sinteticamente solo la stringa pathname:
 *   <Link to="/libro/123" state={{ from: location.pathname }}>
 * e il label viene derivato in {@link labelForPath}.
 */
export type BackTarget = { to: string; label: string };

const DEFAULT_TARGET: BackTarget = { to: '/mappa', label: 'Torna alla mappa' };

export function labelForPath(pathname: string): BackTarget {
  if (pathname === '/' || pathname === '/mappa' || pathname.startsWith('/mappa')) {
    return { to: '/mappa', label: 'Torna alla mappa' };
  }
  if (pathname.startsWith('/cerca')) {
    return { to: pathname, label: 'Torna alla ricerca' };
  }
  if (pathname.startsWith('/zaino')) {
    return { to: '/zaino', label: 'Torna allo zaino' };
  }
  if (pathname.startsWith('/punto/')) {
    return { to: pathname, label: 'Torna al punto' };
  }
  if (pathname.startsWith('/profilo')) {
    return { to: '/profilo', label: 'Torna al profilo' };
  }
  if (pathname.startsWith('/admin')) {
    return { to: pathname, label: 'Torna all\u2019admin' };
  }
  if (pathname.startsWith('/manager') || pathname.startsWith('/gestore')) {
    return { to: pathname, label: 'Torna a Il mio punto' };
  }
  return { to: pathname, label: 'Indietro' };
}

export function useBackTarget(fallback: BackTarget = DEFAULT_TARGET): BackTarget {
  const location = useLocation();
  const state = location.state as
    | { from?: BackTarget | string | undefined }
    | null
    | undefined;
  const fromState = state?.from;
  if (typeof fromState === 'object' && fromState && fromState.to && fromState.label) {
    return fromState;
  }
  if (typeof fromState === 'string' && fromState.length > 0) {
    return labelForPath(fromState);
  }
  return fallback;
}

export default function BackLink({
  fallback,
  className = 'book-page-back',
  overrideLabel,
}: {
  fallback?: BackTarget;
  className?: string;
  overrideLabel?: string;
}) {
  const target = useBackTarget(fallback);
  return (
    <Link to={target.to} className={className} replace>
      <ChevronLeftIcon />
      {overrideLabel ?? target.label}
    </Link>
  );
}
