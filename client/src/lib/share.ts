import { toast } from '@/stores/toastStore';

export function absoluteLiberyUrl(path: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${origin}${normalized}`;
}

/** Condivide un link Libery (Web Share API o copia negli appunti). */
export async function shareLiberyLink(opts: {
  path: string;
  title?: string;
  text?: string;
}): Promise<void> {
  const url = absoluteLiberyUrl(opts.path);
  const shareData = {
    title: opts.title ?? 'Libery',
    text: opts.text,
    url,
  };

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share(shareData);
      return;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
    }
  }

  try {
    await navigator.clipboard.writeText(url);
    toast.success('Link copiato negli appunti');
  } catch {
    toast.error('Impossibile condividere il link');
  }
}
