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

export function parseIsbn(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const labeled = trimmed.match(/(?:ISBN[-\s:]*)?(\d[\dXx\s-]{8,17}\d)/i);
  const raw = (labeled ? labeled[1]! : trimmed).replace(/[\s-]/g, '');
  const digits = raw.replace(/\D/g, '');

  if (digits.length === 13) return digits;
  if (digits.length === 10) return isbn10to13(digits);
  // EAN-13 senza cifra iniziale (alcuni lettori)
  if (digits.length === 12 && (digits.startsWith('978') || digits.startsWith('979'))) {
    return `0${digits}`;
  }
  // ISBN-10 con checksum X
  if (digits.length === 9 && /^\d{9}$/.test(digits)) {
    const withX = `${digits}X`;
    return isbn10to13(withX);
  }
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
