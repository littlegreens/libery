import type { GoogleBookPayload } from './googleBooks.js';
import { normalizeIsbn } from './isbn.js';

const USER_AGENT = 'Libery/1.0 (https://libery.app; book metadata)';

type SparqlBinding = {
  value: string;
  type?: string;
};

type SparqlResponse = {
  results?: {
    bindings?: Array<{
      itemLabel?: SparqlBinding;
      authorLabel?: SparqlBinding;
      date?: SparqlBinding;
      publisherLabel?: SparqlBinding;
    }>;
  };
};

function parseYearFromWikidataDate(value?: string): number | null {
  if (!value) return null;
  const y = parseInt(value.slice(0, 4), 10);
  return Number.isFinite(y) ? y : null;
}

export async function fetchBookFromWikidata(rawIsbn: string): Promise<GoogleBookPayload | null> {
  const isbn = normalizeIsbn(rawIsbn);
  if (!isbn) return null;

  const query = `
SELECT ?itemLabel ?authorLabel ?date ?publisherLabel WHERE {
  ?item wdt:P212 "${isbn}".
  OPTIONAL { ?item wdt:P50 ?author. ?author rdfs:label ?authorLabel. FILTER(LANG(?authorLabel) IN ("it", "en")) }
  OPTIONAL { ?item wdt:P577 ?date }
  OPTIONAL { ?item wdt:P123 ?publisher. ?publisher rdfs:label ?publisherLabel. FILTER(LANG(?publisherLabel) IN ("it", "en")) }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "it,en". }
}
LIMIT 1`.trim();

  const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`;

  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/sparql-results+json', 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(14_000),
    });
    if (!res.ok) return null;

    const data = (await res.json()) as SparqlResponse;
    const row = data.results?.bindings?.[0];
    if (!row?.itemLabel?.value || row.itemLabel.value === 'No label') return null;

    return {
      isbn,
      title: row.itemLabel.value,
      author: row.authorLabel?.value ?? null,
      publisher: row.publisherLabel?.value ?? null,
      year: parseYearFromWikidataDate(row.date?.value),
      edition: null,
      description: null,
      language: 'it',
      pages: null,
      genre: null,
      coverUrl: null,
    };
  } catch {
    return null;
  }
}
