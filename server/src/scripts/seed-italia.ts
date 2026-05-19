/**
 * Seed Italia v3:
 *  - 20 punti reali (biblioteche, librerie, corner free) distribuiti in Italia
 *  - 100 libri italiani reali presi via Google Books (ricerca per categoria/lingua=it)
 *  - Distribuzione bilanciata: ogni libro su 3-5 punti, copies 1-3
 *
 * Lancia con:  npm run seed:italia
 */

import 'dotenv/config';
import { prisma } from '../lib/prisma.js';
import { resolveBookByIsbn } from '../services/bookCatalog.js';
import { normalizeIsbn } from '../lib/isbn.js';

// ---------- 20 PUNTI ----------

type SeedPoint = {
  qrToken: string;
  name: string;
  type: 'biblioteca' | 'libreria' | 'corner_free';
  city: string;
  address: string;
  latitude: number;
  longitude: number;
  description: string;
  managerEmail?: string;
};

const openingStandard = {
  lunedi: '09:00-19:00',
  martedi: '09:00-19:00',
  mercoledi: '09:00-19:00',
  giovedi: '09:00-19:00',
  venerdi: '09:00-20:00',
  sabato: '10:00-18:00',
  domenica: 'chiuso',
};

const POINTS: SeedPoint[] = [
  // —— Biblioteche ——
  {
    qrToken: 'seed-bib-alessandrina-roma',
    name: 'Biblioteca Alessandrina',
    type: 'biblioteca',
    city: 'Roma',
    address: 'Piazzale Aldo Moro 5',
    latitude: 41.9028,
    longitude: 12.5167,
    description: 'Storica biblioteca universitaria. Scaffale Libery vicino all\'ingresso.',
    managerEmail: 'gestore.alessandrina@libery.test',
  },
  {
    qrToken: 'seed-bib-salaborsa-bologna',
    name: 'Biblioteca Salaborsa',
    type: 'biblioteca',
    city: 'Bologna',
    address: 'Piazza Nettuno 3',
    latitude: 44.4942,
    longitude: 11.3431,
    description: 'Biblioteca civica nel cuore di Bologna. Punto Libery al piano terra.',
    managerEmail: 'gestore.bologna@libery.test',
  },
  {
    qrToken: 'seed-bib-marciana-venezia',
    name: 'Biblioteca Nazionale Marciana',
    type: 'biblioteca',
    city: 'Venezia',
    address: 'Piazzetta San Marco 7',
    latitude: 45.4337,
    longitude: 12.3389,
  description: 'Biblioteca storica veneziana, lo scaffale Libery e\' nella sala lettura.',
  },
  {
    qrToken: 'seed-bib-sormani-milano',
    name: 'Biblioteca Sormani',
    type: 'biblioteca',
    city: 'Milano',
    address: 'Via Francesco Sforza 7',
    latitude: 45.4598,
    longitude: 9.1949,
    description: 'Centrale milanese del sistema bibliotecario. Scaffale Libery al desk informazioni.',
  },
  {
    qrToken: 'seed-bib-berio-genova',
    name: 'Biblioteca Berio',
    type: 'biblioteca',
    city: 'Genova',
    address: 'Via del Seminario 16',
    latitude: 44.4072,
    longitude: 8.9345,
    description: 'Una delle principali biblioteche civiche di Genova. Circuito Libery attivo dal 2024.',
    managerEmail: 'gestore.genova@libery.test',
  },
  {
    qrToken: 'seed-bib-nazionale-firenze',
    name: 'Biblioteca Nazionale Centrale',
    type: 'biblioteca',
    city: 'Firenze',
    address: 'Piazza dei Cavalleggeri 1',
    latitude: 43.7669,
    longitude: 11.2606,
    description: 'Tra le piu\' grandi biblioteche italiane. Spazio Libery nell\'atrio.',
  },
  {
    qrToken: 'seed-bib-uberto-torino',
    name: 'Biblioteca Civica Uberto De Angelis',
    type: 'biblioteca',
    city: 'Torino',
    address: 'Via delle Orfane 24',
    latitude: 45.0703,
    longitude: 7.6869,
    description: 'Biblioteca di quartiere nel centro storico torinese. Scaffale Libery in sala lettura.',
    managerEmail: 'gestore.torino@libery.test',
  },

  // —— Librerie ——
  {
    qrToken: 'seed-lib-feltrinelli-roma',
    name: 'laFeltrinelli Galleria Alberto Sordi',
    type: 'libreria',
    city: 'Roma',
    address: 'Galleria Alberto Sordi 31-35',
    latitude: 41.9013,
    longitude: 12.4823,
    description: 'Libreria centrale a Piazza Colonna. Angolo Libery dedicato al bookcrossing.',
  },
  {
    qrToken: 'seed-lib-hoepli-milano',
    name: 'Libreria Hoepli',
    type: 'libreria',
    city: 'Milano',
    address: 'Via Ulrico Hoepli 5',
    latitude: 45.4665,
    longitude: 9.1900,
    description: 'Storica libreria milanese su sei piani. Bookcrossing al piano terra.',
  },
  {
    qrToken: 'seed-lib-trame-bologna',
    name: 'Libreria Trame',
    type: 'libreria',
    city: 'Bologna',
    address: 'Via Goito 3/c',
    latitude: 44.4976,
    longitude: 11.3454,
    description: 'Libreria indipendente di riferimento bolognese. Scambio libri all\'ingresso.',
  },
  {
    qrToken: 'seed-lib-spagnolo-napoli',
    name: 'Libreria Spagnolo',
    type: 'libreria',
    city: 'Napoli',
    address: 'Via dei Fiorentini 50',
    latitude: 40.8425,
    longitude: 14.2503,
    description: 'Libreria indipendente in centro a Napoli, sezione bookcrossing dedicata.',
  },
  {
    qrToken: 'seed-lib-broadway-bari',
    name: 'Libreria Broadway',
    type: 'libreria',
    city: 'Bari',
    address: 'Via Andrea da Bari 157',
    latitude: 41.1257,
    longitude: 16.8662,
    description: 'Libreria storica barese. Vetrina bookcrossing Libery sempre rifornita.',
  },
  {
    qrToken: 'seed-lib-modusvivendi-palermo',
    name: 'Modusvivendi Libreria',
    type: 'libreria',
    city: 'Palermo',
    address: 'Via Quintino Sella 79',
    latitude: 38.1244,
    longitude: 13.3611,
    description: 'Libreria culturale palermitana. Punto Libery sulla rete cittadina.',
  },

  // —— Corner Free ——
  {
    qrToken: 'seed-corner-trastevere-roma',
    name: 'Corner Libery Piazza Trilussa',
    type: 'corner_free',
    city: 'Roma',
    address: 'Piazza Trilussa',
    latitude: 41.8895,
    longitude: 12.4690,
    description: 'Scaffale all\'aperto sotto il portico. Prendi un libro, lasciane un altro.',
  },
  {
    qrToken: 'seed-corner-isola-milano',
    name: 'Corner Libery Isola',
    type: 'corner_free',
    city: 'Milano',
    address: 'Via Borsieri 12',
    latitude: 45.4870,
    longitude: 9.1893,
    description: 'Corner di quartiere a Isola, gestito dai residenti.',
  },
  {
    qrToken: 'seed-corner-vomero-napoli',
    name: 'Corner Libery Vomero',
    type: 'corner_free',
    city: 'Napoli',
    address: 'Via Luca Giordano 47',
    latitude: 40.8467,
    longitude: 14.2308,
    description: 'Casetta di legno al parco. Apertura 24/7.',
  },
  {
    qrToken: 'seed-corner-vanchiglia-torino',
    name: 'Corner Libery Vanchiglia',
    type: 'corner_free',
    city: 'Torino',
    address: 'Largo Montebello 28',
    latitude: 45.0727,
    longitude: 7.6943,
    description: 'Scaffale libero davanti al circolo di lettura del quartiere.',
  },
  {
    qrToken: 'seed-corner-pignasecca-napoli',
    name: 'Corner Libery Pignasecca',
    type: 'corner_free',
    city: 'Napoli',
    address: 'Via Pignasecca 5',
    latitude: 40.8456,
    longitude: 14.2492,
    description: 'Punto bookcrossing nel mercato della Pignasecca.',
  },
  {
    qrToken: 'seed-corner-stradenuove-bari',
    name: 'Corner Libery Murat',
    type: 'corner_free',
    city: 'Bari',
    address: 'Corso Vittorio Emanuele 142',
    latitude: 41.1280,
    longitude: 16.8678,
    description: 'Stand sulla passeggiata, custodito da volontari locali.',
  },
  {
    qrToken: 'seed-corner-ortigia-siracusa',
    name: 'Corner Libery Ortigia',
    type: 'corner_free',
    city: 'Siracusa',
    address: 'Via Roma 105, Ortigia',
    latitude: 37.0608,
    longitude: 15.2929,
    description: 'Punto libero sotto le mura di Ortigia. Sempre accessibile.',
  },
];

// ---------- 100 LIBRI ----------

/**
 * Strategia: si interroga Google Books con query per categoria + lingua italiana,
 * paginando finche' non si raggiungono N ISBN-13 distinti.
 *
 * Niente lista hardcoded di ISBN: cosi' tutti i libri sono reali e con metadati pieni
 * dal momento del seed.
 */
const QUERY_BUCKETS = [
  'subject:fiction',
  'subject:romanzo',
  'subject:novel',
  'subject:storia',
  'subject:thriller',
  'subject:poesia',
  'subject:saggi',
  'subject:biografia',
  'inauthor:"italo calvino"',
  'inauthor:"umberto eco"',
  'inauthor:"andrea camilleri"',
  'inauthor:"elena ferrante"',
  'inauthor:"niccolo ammaniti"',
  'inauthor:"primo levi"',
  'inauthor:"alessandro baricco"',
  'inauthor:"dacia maraini"',
  'inauthor:"erri de luca"',
  'inauthor:"alessandro manzoni"',
  'inauthor:"luigi pirandello"',
  'inauthor:"giovanni verga"',
];

const TARGET_BOOKS = 100;
const PAGE_SIZE = 40; // max consentito da Google Books

type LightBook = {
  isbn: string;
  title: string;
  author: string | null;
};

async function fetchIsbnsFromGoogleBooks(target: number): Promise<LightBook[]> {
  const apiKey = process.env.GOOGLE_BOOKS_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "GOOGLE_BOOKS_API_KEY non configurata in .env: necessario per il seed reale.",
    );
  }

  const seen = new Set<string>();
  const out: LightBook[] = [];

  for (const q of QUERY_BUCKETS) {
    if (out.length >= target) break;

    for (let startIndex = 0; startIndex < 80 && out.length < target; startIndex += PAGE_SIZE) {
      const url =
        `https://www.googleapis.com/books/v1/volumes` +
        `?q=${encodeURIComponent(q)}` +
        `&langRestrict=it&printType=books&orderBy=relevance` +
        `&maxResults=${PAGE_SIZE}&startIndex=${startIndex}` +
        `&key=${encodeURIComponent(apiKey)}`;

      let res: Response;
      try {
        res = await fetch(url, {
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(12_000),
        });
      } catch (err) {
        console.warn(`  [${q}] errore fetch:`, (err as Error).message);
        break;
      }
      if (!res.ok) {
        console.warn(`  [${q}] HTTP ${res.status}`);
        break;
      }

      const data = (await res.json()) as {
        items?: Array<{
          volumeInfo?: {
            title?: string;
            authors?: string[];
            industryIdentifiers?: Array<{ type?: string; identifier?: string }>;
            language?: string;
          };
        }>;
      };

      if (!data.items?.length) break;

      for (const item of data.items) {
        const info = item.volumeInfo;
        if (!info?.title) continue;
        if (info.language && info.language !== 'it') continue;
        const raw = info.industryIdentifiers?.find(
          (i) => i.type === 'ISBN_13' || (i.identifier && i.identifier.length === 13),
        )?.identifier;
        const isbn = raw ? normalizeIsbn(raw) : null;
        if (!isbn || seen.has(isbn)) continue;
        seen.add(isbn);
        out.push({
          isbn,
          title: info.title,
          author: info.authors?.length ? info.authors.join(', ') : null,
        });
        if (out.length >= target) break;
      }
    }
  }

  return out;
}

// ---------- DISTRIBUZIONE ----------

/**
 * PRNG deterministico (mulberry32) per riproducibilita' della distribuzione.
 */
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickRandom<T>(arr: T[], n: number, rng: () => number): T[] {
  const copy = arr.slice();
  const out: T[] = [];
  for (let i = 0; i < n && copy.length > 0; i++) {
    const idx = Math.floor(rng() * copy.length);
    out.push(copy.splice(idx, 1)[0]!);
  }
  return out;
}

// ---------- MAIN ----------

async function main() {
  console.log('Seed Italia v3 — 20 punti + 100 libri reali\n');

  // 1) Punti
  const pointIds: string[] = [];
  for (const p of POINTS) {
    let managerId: string | null = null;
    if (p.managerEmail) {
      const manager = await prisma.user.findUnique({ where: { email: p.managerEmail } });
      managerId = manager?.id ?? null;
    }

    const existing = await prisma.point.findFirst({ where: { qrToken: p.qrToken } });
    const point = existing
      ? await prisma.point.update({
          where: { id: existing.id },
          data: {
            name: p.name,
            type: p.type,
            status: 'approved',
            setupCompleted: true,
            address: p.address,
            city: p.city,
            latitude: p.latitude,
            longitude: p.longitude,
            description: p.description,
            openingHours: openingStandard,
            managerId,
          },
        })
      : await prisma.point.create({
          data: {
            name: p.name,
            type: p.type,
            status: 'approved',
            setupCompleted: true,
            address: p.address,
            city: p.city,
            latitude: p.latitude,
            longitude: p.longitude,
            description: p.description,
            openingHours: openingStandard,
            managerId,
            approvedAt: new Date(),
            qrToken: p.qrToken,
          },
        });
    pointIds.push(point.id);
    console.log(`  [punto] ${p.type.padEnd(11)} ${p.name} (${p.city})`);
  }

  // 2) Libri (cerca ISBN reali su Google Books)
  console.log(`\nRecupero ${TARGET_BOOKS} libri italiani reali da Google Books...`);
  const lightBooks = await fetchIsbnsFromGoogleBooks(TARGET_BOOKS);
  console.log(`  Trovati ${lightBooks.length} ISBN-13 distinti`);

  const persistedBookIds: string[] = [];
  let resolved = 0;
  let failures = 0;
  for (let i = 0; i < lightBooks.length; i++) {
    const lb = lightBooks[i]!;
    process.stdout.write(`  [${i + 1}/${lightBooks.length}] ${lb.isbn} ${lb.title.slice(0, 40)}… `);
    try {
      const r = await resolveBookByIsbn(lb.isbn);
      if (r.ok) {
        persistedBookIds.push(r.book.id);
        resolved++;
        process.stdout.write('ok\n');
      } else {
        failures++;
        process.stdout.write('miss\n');
      }
    } catch (err) {
      failures++;
      process.stdout.write(`errore (${(err as Error).message})\n`);
    }
  }
  console.log(`  Libri risolti: ${resolved}, falliti: ${failures}`);

  // 3) Distribuzione
  console.log('\nDistribuzione su punti...');
  const rng = mulberry32(42);
  let totalAssignments = 0;
  let totalCopies = 0;

  for (const bookId of persistedBookIds) {
    const numPoints = 3 + Math.floor(rng() * 3); // 3..5
    const chosen = pickRandom(pointIds, numPoints, rng);
    for (const pointId of chosen) {
      const point = POINTS[pointIds.indexOf(pointId)]!;
      // Corner free piu' parsimoniosi (1 copia), biblioteche/librerie 1-3.
      const copies =
        point.type === 'corner_free'
          ? 1
          : 1 + Math.floor(rng() * 3);

      await prisma.pointBook.upsert({
        where: { pointId_bookId: { pointId, bookId } },
        create: {
          pointId,
          bookId,
          copies,
          status: 'active',
          firstAddedAt: new Date(),
        },
        update: { copies, status: 'active' },
      });
      totalAssignments++;
      totalCopies += copies;
    }
  }

  console.log(`\nRiepilogo:`);
  console.log(`  Punti: ${POINTS.length}`);
  console.log(`  Libri in catalogo dopo seed: ${persistedBookIds.length}`);
  console.log(`  Righe inventario create/aggiornate: ${totalAssignments}`);
  console.log(`  Copie totali distribuite: ${totalCopies}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
