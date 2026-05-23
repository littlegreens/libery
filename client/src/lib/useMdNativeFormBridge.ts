import type { RefObject } from 'react';
import { useEffect } from 'react';

function firstEventTarget(ev: KeyboardEvent): HTMLElement | null {
  const p = ev.composedPath();
  const n = p[0];
  return n instanceof HTMLElement ? n : null;
}

/**
 * Campo nella path che rientra in un host `md-search` / `md-text-field`
 * contenuto nella form (shadow DOM incluso tramite composedPath).
 */
function isFieldInMaterialHostUnderForm(ev: KeyboardEvent, form: HTMLFormElement): boolean {
  const path = ev.composedPath();
  const fields = form.querySelectorAll('md-search, md-text-field');
  for (const host of fields) {
    const el = host as HTMLElement;
    const root = el.shadowRoot;
    if (root) {
      for (const p of path) {
        if (p instanceof Node && (p === el || root.contains(p))) return true;
      }
    } else if (path.includes(el)) {
      return true;
    }
  }
  return false;
}

/**
 * Invio dentro `md-search` / `md-text-field` (Lit, shadow) invoca il submit della `<form>`.
 */
export function useMdNativeFormBridge(formRef: RefObject<HTMLFormElement | null>): void {
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;

    const onKeyCapture = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return;
      if (e.repeat || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if ('isComposing' in e && e.isComposing) return;

      const t0 = firstEventTarget(e);
      if (t0?.tagName === 'TEXTAREA' || (t0 as HTMLElement | null)?.isContentEditable) return;

      if (!isFieldInMaterialHostUnderForm(e, form)) return;

      e.preventDefault();
      try {
        form.requestSubmit();
      } catch {
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      }
    };

    document.addEventListener('keydown', onKeyCapture, true);
    return () => document.removeEventListener('keydown', onKeyCapture, true);
  });
}
