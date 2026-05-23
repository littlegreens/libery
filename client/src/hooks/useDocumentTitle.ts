import { useEffect } from 'react';

const BASE = 'Libery';

/**
 * Imposta document.title per la pagina corrente.
 * WCAG 2.4.2 — ogni pagina deve avere un titolo descrittivo.
 */
export function useDocumentTitle(title?: string | null) {
  useEffect(() => {
    document.title = title ? `${title} · ${BASE}` : BASE;
    return () => {
      document.title = BASE;
    };
  }, [title]);
}
