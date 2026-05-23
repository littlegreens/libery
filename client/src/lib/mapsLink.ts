/** Apre Google Maps (stesso schema usato da molte app Material / Android). */
export function externalMapsSearchUrl(
  lat?: number | null,
  lng?: number | null,
  address?: string | null,
  city?: string | null,
): string {
  if (lat != null && lng != null) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`;
  }
  const q = [address, city].filter(Boolean).join(', ');
  if (q.trim()) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
  }
  return 'https://www.google.com/maps';
}
