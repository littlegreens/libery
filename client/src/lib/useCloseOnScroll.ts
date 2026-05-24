import { useEffect, type RefObject } from 'react';

const EXTRA_SCROLL_SELECTORS = '.app-main, .libery-bottom-sheet-scroll, .libery-book-sheet';

function isScrollable(el: HTMLElement): boolean {
  const { overflowY, overflow } = getComputedStyle(el);
  return /(auto|scroll|overlay)/.test(`${overflowY} ${overflow}`);
}

function collectScrollTargets(anchor: HTMLElement | null): EventTarget[] {
  const seen = new Set<EventTarget>();
  const targets: EventTarget[] = [];

  const add = (t: EventTarget | null) => {
    if (t && !seen.has(t)) {
      seen.add(t);
      targets.push(t);
    }
  };

  add(window);

  let node: HTMLElement | null = anchor;
  while (node) {
    if (isScrollable(node)) add(node);
    node = node.parentElement;
  }

  document.querySelectorAll(EXTRA_SCROLL_SELECTORS).forEach((el) => {
    if (el instanceof HTMLElement) add(el);
  });

  return targets;
}

/** Chiude un popover/menu quando l’utente scrolla (lista, pagina, bottom sheet). */
export function useCloseOnScroll(open: boolean, onClose: () => void, anchorRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return;

    const close = () => onClose();

    const scrollTargets = collectScrollTargets(anchorRef.current);
    for (const target of scrollTargets) {
      target.addEventListener('scroll', close, { passive: true });
    }

    // Rotella/trackpad: ignora scroll dentro bottom sheet (contenuto scrollabile)
    const onWheel = (e: WheelEvent) => {
      const t = e.target;
      if (t instanceof Element && t.closest('.libery-bottom-sheet-scroll')) return;
      close();
    };
    document.addEventListener('wheel', onWheel, { capture: true, passive: true });

    return () => {
      for (const target of scrollTargets) {
        target.removeEventListener('scroll', close);
      }
      document.removeEventListener('wheel', onWheel, { capture: true });
    };
  }, [open, onClose, anchorRef]);
}
