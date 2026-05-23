/** Log strutturato in console dopo GET /books/isbn */

type Attempt = {
  source: string;
  status: string;
  detail?: string;
};

type SourceSnap = {
  title: string | null;
  author: string | null;
  descriptionLen: number;
  cover: string | null;
  year: number | null;
};

type Payload = {
  book: {
    title: string;
    author: string | null;
    isbn: string;
    description?: string | null;
    coverPath?: string | null;
    publisher?: string | null;
    year?: number | null;
    genre?: string | null;
  };
  provider?: string;
  fromCache?: boolean;
  source: string;
  created: boolean;
  fieldsUpdated?: string[];
  attempts?: Attempt[];
  debug?: {
    googleBooksConfigured?: boolean;
    coverInDb?: boolean;
    coverSentToClient?: boolean;
    coverFallbackUsed?: boolean;
    sources?: Record<string, SourceSnap | null>;
  };
};

const API_NAMES: Record<string, string> = {
  google_books: 'Google Books',
  google: 'Google Books',
  openlibrary: 'Open Library',
  wikidata: 'Wikidata',
  db: 'Catalogo Libery (DB)',
  merged: 'Merge finale',
};

const PROVIDER_NAMES: Record<string, string> = {
  google: 'Google Books',
  openlibrary: 'Open Library',
  wikidata: 'Wikidata',
  db: 'Catalogo Libery — nessun aggiornamento esterno',
};

export function logBookResolveToConsole(isbn: string, data: Payload) {
  const provider = data.provider ?? 'db';
  const descLen = data.book.description?.trim().length ?? 0;

  console.group(`%c[Libery] Recupero ISBN ${isbn}`, 'font-weight:bold;color:#1a4d8c');
  console.log('Endpoint:', `GET /api/books/isbn/${isbn}?debug=1`);

  console.log('%cFonte usata per il client', 'font-weight:bold', PROVIDER_NAMES[provider] ?? provider);
  if (data.fromCache) {
    console.log('%cSolo database', 'font-weight:bold;color:#027a48', '— nessuna chiamata Google/Open Library');
  }
  console.log('Record DB (source):', data.source, '| creato ora:', data.created ? 'sì' : 'no');
  if (data.fieldsUpdated?.length) {
    console.log('Campi aggiornati in DB:', data.fieldsUpdated.join(', '));
  } else {
    console.log('Campi aggiornati in DB: nessuno (dati già in catalogo)');
  }

  console.log('%cRisultato ricerca API (ordine server)', 'font-weight:bold');
  if (data.attempts?.length) {
    console.table(
      data.attempts.map((a) => ({
        API: API_NAMES[a.source] ?? a.source,
        esito: a.status,
        nota: a.detail ?? '',
      })),
    );
  } else {
    console.warn('Nessun tentativo API nella risposta — il server è aggiornato?');
  }

  if (data.debug?.sources) {
    console.log('%cDati grezzi per fonte (debug)', 'font-weight:bold');
    const rows = Object.entries(data.debug.sources).map(([key, snap]) => ({
      API: API_NAMES[key] ?? key,
      titolo: snap?.title ?? '—',
      autore: snap?.author ?? '—',
      trama_car: snap?.descriptionLen ?? 0,
      copertina: snap?.cover ? 'sì' : 'no',
      anno: snap?.year ?? '—',
    }));
    console.table(rows);
  }

  if (data.debug) {
    console.log('Copertina in DB:', data.debug.coverInDb ? 'sì' : 'no');
    console.log('Copertina inviata al client:', data.debug.coverSentToClient ? 'sì' : 'no');
    if (data.debug.coverFallbackUsed) {
      console.log('⚠ Copertina solo fallback Open Library (non salvata in DB)');
    }
    if (data.debug.googleBooksConfigured === false) {
      console.warn('GOOGLE_BOOKS_API_KEY assente in server/.env');
    }
  }

  console.log('%cDati mostrati in app', 'font-weight:bold', {
    titolo: data.book.title,
    autore: data.book.author ?? '—',
    editore: data.book.publisher ?? '—',
    anno: data.book.year ?? '—',
    trama_caratteri: descLen,
    copertina_url: data.book.coverPath ?? '—',
    genere: data.book.genre ?? '—',
  });

  console.groupEnd();
}
