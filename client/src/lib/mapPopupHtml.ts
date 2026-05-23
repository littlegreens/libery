import { createPointTypeBadgeElement } from '@/components/PointTypeBadge';
import type { MapPoint } from '@/types/point';

function formatAddress(p: MapPoint): string {
  const parts = [p.address, p.city].filter((s): s is string => Boolean(s?.trim()));
  return parts.join(', ');
}

/** Prime due righe della descrizione (o meno se il testo è più corto). */
export function mapPopupDescriptionExcerpt(description: string | null | undefined): string | null {
  const raw = description?.trim();
  if (!raw) return null;
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const excerpt = (lines.length > 0 ? lines : [raw]).slice(0, 2).join(' ');
  return excerpt || null;
}

/** Contenuto popup mappa (DOM): badge, titolo, indirizzo, descrizione (max 2 righe). */
export function buildMapPopupElement(p: MapPoint): HTMLElement {
  const link = document.createElement('a');
  link.href = `/punto/${p.id}`;
  link.className = 'map-popup-card-link';

  link.appendChild(createPointTypeBadgeElement(p.type, 'small'));

  const title = document.createElement('span');
  title.className = 'map-popup-title';
  title.textContent = p.name;
  link.appendChild(title);

  const addressLine = formatAddress(p);
  if (addressLine) {
    const address = document.createElement('p');
    address.className = 'map-popup-address';
    address.textContent = addressLine;
    link.appendChild(address);
  }

  const descLine = mapPopupDescriptionExcerpt(p.description);
  if (descLine) {
    const desc = document.createElement('p');
    desc.className = 'map-popup-desc';
    desc.textContent = descLine;
    link.appendChild(desc);
  }

  return link;
}
