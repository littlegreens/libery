/** Normalizza ISBN-10/13 in ISBN-13 (solo cifre). */
export function normalizeIsbn(raw: string): string | null {
  const cleaned = raw.replace(/[^0-9Xx]/gi, '').toUpperCase();
  if (!cleaned) return null;

  if (cleaned.length === 13) {
    if (!/^\d{13}$/.test(cleaned)) return null;
    return cleaned;
  }

  if (cleaned.length === 10) {
    const core = cleaned.slice(0, 9);
    if (!/^\d{9}$/.test(core) && !/^\d{8}[\dX]$/.test(cleaned.slice(0, 10))) {
      // accetta 9 cifre + check (X o cifra)
    }
    const nine = cleaned.slice(0, 9);
    if (!/^\d{9}$/.test(nine)) return null;
    return isbn10to13(cleaned);
  }

  const digitsOnly = raw.replace(/\D/g, '');
  if (digitsOnly.length === 13) return digitsOnly;
  if (digitsOnly.length === 10) return isbn10to13(digitsOnly);

  return null;
}

function isbn10to13(isbn10: string): string {
  const s = isbn10.replace(/[^0-9X]/gi, '').toUpperCase();
  const nine = s.slice(0, 9);
  const stem = `978${nine}`;
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(stem[i]!, 10) * (i % 2 === 0 ? 1 : 3);
  }
  const check = (10 - (sum % 10)) % 10;
  return stem + String(check);
}

export function isValidIsbnInput(raw: string): boolean {
  return normalizeIsbn(raw) !== null;
}
