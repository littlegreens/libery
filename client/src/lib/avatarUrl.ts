/** URL avatar con parametro versione per aggirare la cache del browser dopo un upload. */
export function withAvatarCacheBust(url: string | null | undefined, version?: number): string | null {
  if (!url) return null;
  const base = url.split('?')[0];
  const v = version ?? Date.now();
  return `${base}?v=${v}`;
}
