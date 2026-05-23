/** Decodifica entità HTML comuni (senza dipendenze). */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

/**
 * Trama da catalogo (spesso HTML da Google Books) → testo con paragrafi.
 */
export function bookDescriptionToPlainText(raw: string): string {
  let t = raw.trim();
  if (!t) return '';
  if (!/<[a-z][\s\S]*>/i.test(t)) {
    return decodeHtmlEntities(t);
  }

  t = t
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*/gi, '\n\n')
    .replace(/<p[^>]*>/gi, '')
    .replace(/<\/div>\s*/gi, '\n')
    .replace(/<div[^>]*>/gi, '')
    .replace(/<\/li>\s*/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '');

  t = decodeHtmlEntities(t);
  return t
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/  +/g, ' ')
    .trim();
}

export function bookDescriptionParagraphs(raw: string): string[] {
  const plain = bookDescriptionToPlainText(raw);
  if (!plain) return [];
  return plain.split(/\n\n+/).map((p) => p.replace(/\n/g, ' ').trim()).filter(Boolean);
}
