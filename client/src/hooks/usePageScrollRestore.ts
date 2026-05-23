import { useLayoutEffect, useRef } from 'react';

const scrollPositions = new Map<string, number>();

function getScrollRoot(): HTMLElement | null {
  return document.querySelector('.app-main');
}

type Options = {
  /** Attendi dati/lista prima di ripristinare (es. inventario punto). */
  ready?: boolean;
};

/** Ripristina lo scroll di `.app-main` quando si torna indietro (es. da scheda libro). */
export function usePageScrollRestore(scrollKey: string | null, options?: Options) {
  const ready = options?.ready ?? true;
  const keyRef = useRef(scrollKey);
  keyRef.current = scrollKey;

  useLayoutEffect(() => {
    if (!scrollKey || !ready) return;
    const root = getScrollRoot();
    if (!root) return;
    const saved = scrollPositions.get(scrollKey);
    if (saved == null) return;
    root.scrollTop = saved;
    requestAnimationFrame(() => {
      root.scrollTop = saved;
    });
  }, [scrollKey, ready]);

  useLayoutEffect(() => {
    return () => {
      const key = keyRef.current;
      if (!key) return;
      const root = getScrollRoot();
      if (!root) return;
      scrollPositions.set(key, root.scrollTop);
    };
  }, [scrollKey]);
}
