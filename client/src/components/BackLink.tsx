import { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { MdIcon } from '@/lib/material/md-react';

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
  if (pathname.startsWith('/cerca') || pathname.startsWith('/libri')) {
    return { to: '/libri', label: 'Torna ai libri' };
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
  return useMemo(() => {
    const state = location.state as
      | { from?: BackTarget | string | undefined }
      | null
      | undefined;
    const fromState = state?.from;
    if (typeof fromState === 'object' && fromState && fromState.to && fromState.label) {
      return { to: fromState.to, label: fromState.label };
    }
    if (typeof fromState === 'string' && fromState.length > 0) {
      return labelForPath(fromState);
    }
    return fallback;
  }, [location.pathname, location.key, fallback.to, fallback.label]);
}

export default function BackLink({
  fallback,
  className,
  overrideLabel,
  variant = 'text',
}: {
  fallback?: BackTarget;
  className?: string;
  overrideLabel?: string;
  /** `icon` = pulsante navigazione compatto tipico delle top bar M3 (solo freccia). */
  variant?: 'text' | 'icon';
}) {
  const target = useBackTarget(fallback);
  const label = overrideLabel ?? target.label;

  if (variant === 'icon') {
    return (
      <Link
        to={target.to}
        className={['book-page-back book-page-back--icon', className].filter(Boolean).join(' ')}
        replace
        aria-label={label}
      >
        <MdIcon className="book-page-back-icon">arrow_back</MdIcon>
      </Link>
    );
  }

  return (
    <Link to={target.to} className={['book-page-back', className].filter(Boolean).join(' ')} replace>
      <MdIcon className="book-page-back-icon">arrow_back</MdIcon>
      {label}
    </Link>
  );
}
