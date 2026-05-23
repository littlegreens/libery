/** Estrae token punto da URL Libery o testo QR grezzo */
export function parsePointToken(text: string): string | null {
  const trimmed = text.trim();
  const urlMatch = trimmed.match(/\/punto\/([a-zA-Z0-9-]+)/i);
  if (urlMatch) return urlMatch[1];
  if (/^seed-(bib|corner)-[a-z0-9-]+$/i.test(trimmed)) return trimmed;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
    return trimmed;
  }
  return null;
}

function isbn10to13(digits10: string): string {
  const nine = digits10.slice(0, 9);
  const stem = `978${nine}`;
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(stem[i]!, 10) * (i % 2 === 0 ? 1 : 3);
  }
  const check = (10 - (sum % 10)) % 10;
  return stem + String(check);
}

function normalizeIsbnDigits(digits: string): string | null {
  if (digits.length === 13) return digits;
  if (digits.length === 10 && /^\d{9}[\dX]$/.test(digits)) return isbn10to13(digits);
  if (digits.length === 10 && /^\d{10}$/.test(digits)) return isbn10to13(digits);
  // EAN-12 / UPC-A (molti telefoni leggono 12 cifre invece di 13)
  if (digits.length === 12) return `0${digits}`;
  // Lettura rumorosa: una cifra in più
  if (digits.length === 14 && /^97[89]/.test(digits)) return digits.slice(0, 13);
  if (digits.length === 14) return digits.slice(-13);
  // ISBN-10 con checksum X
  if (digits.length === 9 && /^\d{9}$/.test(digits)) {
    return isbn10to13(`${digits}X`);
  }
  return null;
}

export function parseIsbn(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  // ISBN-13 (978/979) ovunque nella stringa — robusto su letture parziali
  const ean13 = trimmed.match(/97[89]\d{10}/);
  if (ean13) return ean13[0];

  const labeled = trimmed.match(/(?:ISBN[-\s:]*)?(\d[\dXx\s-]{8,17}[\dXx])/i);
  const raw = (labeled ? labeled[1]! : trimmed).replace(/[\s-]/g, '');
  const digits = raw.replace(/[^0-9Xx]/gi, '').toUpperCase();

  const normalized = normalizeIsbnDigits(digits);
  if (normalized) return normalized;

  // Ultima risorsa: blocco di 10–14 cifre nel payload
  const run = trimmed.match(/\d{10,14}/);
  if (run) return normalizeIsbnDigits(run[0]);

  return null;
}

export type ScanKind = 'isbn' | 'qr';

export function classifyScan(text: string): { kind: ScanKind; value: string } | null {
  const token = parsePointToken(text);
  if (token) return { kind: 'qr', value: token };
  const isbn = parseIsbn(text);
  if (isbn) return { kind: 'isbn', value: isbn };
  return null;
}
