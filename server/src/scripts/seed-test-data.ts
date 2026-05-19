import 'dotenv/config';
import { prisma } from '../lib/prisma.js';
import { hashPassword } from '../lib/auth.js';
import { resolveBookByIsbn } from '../services/bookCatalog.js';

const openingStandard = {
  lunedi: '09:00-19:00',
  martedi: '09:00-19:00',
  mercoledi: '09:00-19:00',
  giovedi: '09:00-19:00',
  venerdi: '09:00-20:00',
  sabato: '10:00-18:00',
  domenica: 'chiuso',
};

const biblioteche = [
  {
    name: 'Biblioteca Comunale Alessandrina',
    city: 'Roma',
    address: 'Via della Madonna dei Monti 40',
    latitude: 41.8952,
    longitude: 12.4923,
    description:
      'Storica biblioteca nel Rione Monti. Prestito gratuito, sala lettura e angolo bookcrossing Libery all’ingresso.',
    openingHours: openingStandard,
    managerEmail: 'biblio.gestore@libery.test',
  },
  {
    name: 'Biblioteca Civica Uberto De Angelis',
    city: 'Torino',
    address: 'Via delle Orfane 24',
    latitude: 45.0703,
    longitude: 7.6869,
    description:
      'Biblioteca di quartiere nel centro storico torinese. Punto Libery con scaffale dedicato agli scambi tra lettori.',
    openingHours: {
      ...openingStandard,
      venerdi: '09:00-18:30',
    },
    managerEmail: 'gestore.torino@libery.test',
  },
  {
    name: 'Biblioteca Salaborsa',
    city: 'Bologna',
    address: 'Piazza Nettuno 3',
    latitude: 44.4942,
    longitude: 11.3431,
    description:
      'Biblioteca civica in pieno centro. Area Libery vicino all’info point: prendi un libro, lascia un altro.',
    openingHours: {
      lunedi: '14:30-20:00',
      martedi: '10:00-20:00',
      mercoledi: '10:00-20:00',
      giovedi: '10:00-20:00',
      venerdi: '10:00-20:00',
      sabato: '10:00-19:00',
      domenica: 'chiuso',
    },
    managerEmail: 'gestore.bologna@libery.test',
  },
  {
    name: 'Biblioteca Berio',
    city: 'Genova',
    address: 'Via Bertani 8',
    latitude: 44.4072,
    longitude: 8.9345,
    description:
      'Una delle principali biblioteche genovesi. Circuito Libery attivo da 2024 con oltre cento titoli in rotazione.',
    openingHours: openingStandard,
    managerEmail: 'gestore.genova@libery.test',
  },
];

const libri: Array<{
  isbn: string;
  title: string;
  author: string;
  publisher: string;
  year: number;
  genre: string;
  language: string;
  pages: number;
  description: string;
}> = [
  { isbn: '9788806211778', title: 'Il nome della rosa', author: 'Umberto Eco', publisher: 'Bompiani', year: 1980, genre: 'Giallo storico', language: 'it', pages: 512, description: 'Monaci, misteri e biblioteche nel Medioevo.' },
  { isbn: '9788804668253', title: 'Se questo è un uomo', author: 'Primo Levi', publisher: 'Einaudi', year: 1958, genre: 'Memoria', language: 'it', pages: 192, description: 'Testimonianza dalla deportazione ad Auschwitz.' },
  { isbn: '9788807030537', title: 'Gomorra', author: 'Roberto Saviano', publisher: 'Arnoldo Mondadori', year: 2006, genre: 'Saggistica', language: 'it', pages: 320, description: 'Dentro il sistema camorrista.' },
  { isbn: '9788804373315', title: 'Il bar sotto il mare', author: 'Haruki Murakami', publisher: 'Einaudi', year: 2011, genre: 'Narrativa', language: 'it', pages: 160, description: 'Racconti surreali e malinconici.' },
  { isbn: '9788806211143', title: 'La solitudine dei numeri primi', author: 'Paolo Giordano', publisher: 'Mondadori', year: 2008, genre: 'Romanzo', language: 'it', pages: 304, description: 'Due vite parallele unite dalla fragilità.' },
  { isbn: '9788804662404', title: 'Marcovaldo', author: 'Italo Calvino', publisher: 'Einaudi', year: 1963, genre: 'Racconti', language: 'it', pages: 128, description: 'Un uomo in città tra stagioni e meraviglie.' },
  { isbn: '9788806219705', title: 'L\'amica geniale', author: 'Elena Ferrante', publisher: 'Einaudi', year: 2011, genre: 'Romanzo', language: 'it', pages: 336, description: 'Amicizia e destino a Napoli.' },
  { isbn: '9788806213468', title: 'Sostiene Pereira', author: 'Antonio Tabucchi', publisher: 'Feltrinelli', year: 1994, genre: 'Romanzo', language: 'it', pages: 176, description: 'Lisbona, un redattore e la coscienza.' },
  { isbn: '9788806218005', title: 'Canale Misericordia', author: 'Ermanno Rea', publisher: 'Feltrinelli', year: 2018, genre: 'Romanzo', language: 'it', pages: 224, description: 'Napoli, misericordia e resistenza quotidiana.' },
  { isbn: '9788804660141', title: 'Il Gattopardo', author: 'Giuseppe Tomasi di Lampedusa', publisher: 'Feltrinelli', year: 1958, genre: 'Romanzo storico', language: 'it', pages: 288, description: 'La Sicilia al tramonto dell\'aristocrazia.' },
  { isbn: '9788806210120', title: 'Io non ho paura', author: 'Niccolò Ammaniti', publisher: 'Einaudi', year: 2001, genre: 'Romanzo', language: 'it', pages: 208, description: 'Estate in campagna e un segreto nel grano.' },
  { isbn: '9788806215439', title: 'Siddhartha', author: 'Hermann Hesse', publisher: 'Feltrinelli', year: 1922, genre: 'Romanzo filosofico', language: 'it', pages: 160, description: 'Il cammino verso la saggezza in India.' },
  { isbn: '9788804668073', title: '1984', author: 'George Orwell', publisher: 'Mondadori', year: 1949, genre: 'Distopia', language: 'it', pages: 328, description: 'Grande Fratello e il controllo del pensiero.' },
  { isbn: '9788804660121', title: 'Orgoglio e pregiudizio', author: 'Jane Austen', publisher: 'Garzanti', year: 1813, genre: 'Romanzo', language: 'it', pages: 432, description: 'Amori e convenzioni nella campagna inglese.' },
  { isbn: '9788806211785', title: 'Il vecchio e il mare', author: 'Ernest Hemingway', publisher: 'Mondadori', year: 1952, genre: 'Romanzo', language: 'it', pages: 128, description: 'Un pescatore, il mare e la dignità.' },
  { isbn: '9788806212348', title: 'Piccolo principe', author: 'Antoine de Saint-Exupéry', publisher: 'Bompiani', year: 1943, genre: 'Fiaba', language: 'it', pages: 96, description: 'Un viaggio tra stelle e amicizia.' },
  { isbn: '9788806214567', title: 'Cent\'anni di solitudine', author: 'Gabriel García Márquez', publisher: 'Mondadori', year: 1967, genre: 'Realismo magico', language: 'it', pages: 432, description: 'La saga dei Buendía a Macondo.' },
  { isbn: '9788806217890', title: 'Il processo', author: 'Franz Kafka', publisher: 'Einaudi', year: 1925, genre: 'Romanzo', language: 'it', pages: 256, description: 'K. e un tribunale senza volto.' },
  { isbn: '9788806219012', title: 'Fight Club', author: 'Chuck Palahniuk', publisher: 'Einaudi', year: 1996, genre: 'Romanzo', language: 'it', pages: 208, description: 'Insomnia, soap e gruppi di supporto.' },
  { isbn: '9788806213456', title: 'Norwegian Wood', author: 'Haruki Murakami', publisher: 'Einaudi', year: 1987, genre: 'Romanzo', language: 'it', pages: 400, description: 'Giovinezza, musica e perdita a Tokyo.' },
  { isbn: '9788806216789', title: 'La metamorfosi', author: 'Franz Kafka', publisher: 'Einaudi', year: 1915, genre: 'Racconto', language: 'it', pages: 80, description: 'Gregor Samsa si sveglia insetto.' },
  { isbn: '9788806212340', title: 'Il pendolo di Foucault', author: 'Umberto Eco', publisher: 'Bompiani', year: 1988, genre: 'Thriller', language: 'it', pages: 640, description: 'Cospirazioni e Templari nella Milano degli anni Ottanta.' },
  { isbn: '9788806215678', title: 'L\'ecologia del tempo', author: 'Franco Arminio', publisher: 'Minimum Fax', year: 2018, genre: 'Poesia', language: 'it', pages: 96, description: 'Versi lenti per paesi d\'Italia.' },
  { isbn: '9788806218901', title: 'Morte a Venezia', author: 'Thomas Mann', publisher: 'Mondadori', year: 1912, genre: 'Novella', language: 'it', pages: 96, description: 'Bellezza e destino nella laguna.' },
  { isbn: '9788806211234', title: 'Il fu Mattia Pascal', author: 'Luigi Pirandello', publisher: 'Mondadori', year: 1904, genre: 'Romanzo', language: 'it', pages: 240, description: 'Un uomo che rinasce due volte.' },
  { isbn: '9788806214560', title: 'Gli indifferenti', author: 'Alberto Moravia', publisher: 'Bompiani', year: 1929, genre: 'Romanzo', language: 'it', pages: 304, description: 'Borghesia romana tra desiderio e vuoto.' },
  { isbn: '9788806217891', title: 'Cristo si è fermato a Eboli', author: 'Carlo Levi', publisher: 'Einaudi', year: 1945, genre: 'Memoria', language: 'it', pages: 256, description: 'Lucania, confino e umanità contadina.' },
  { isbn: '9788806210123', title: 'Il deserto dei Tartari', author: 'Dino Buzzati', publisher: 'Mondadori', year: 1940, genre: 'Romanzo', language: 'it', pages: 224, description: 'Attesa e sogno in una fortezza di frontiera.' },
  { isbn: '9788806213457', title: 'La luna e i falò', author: 'Cesare Pavese', publisher: 'Einaudi', year: 1950, genre: 'Romanzo', language: 'it', pages: 208, description: 'Ritorno nelle Langhe dopo l\'America.' },
  { isbn: '9788806216780', title: 'Sei personaggi in cerca d\'autore', author: 'Luigi Pirandello', publisher: 'Mondadori', year: 1921, genre: 'Teatro', language: 'it', pages: 96, description: 'Personaggi che escono dal nulla sul palco.' },
  { isbn: '9788806219013', title: 'Zen e l\'arte della manutenzione della motocicletta', author: 'Robert M. Pirsig', publisher: 'Adelphi', year: 1974, genre: 'Saggistica', language: 'it', pages: 432, description: 'Viaggio e qualità attraverso l\'America.' },
];

/** [indice biblioteca 0-3, indice libro, copie] */
const inventario: Array<[number, number, number]> = [
  [0, 0, 2], [0, 1, 1], [0, 2, 1], [0, 5, 2], [0, 6, 1], [0, 9, 1], [0, 12, 2], [0, 15, 1], [0, 22, 1], [0, 25, 1],
  [1, 0, 1], [1, 3, 2], [1, 4, 1], [1, 7, 2], [1, 8, 1], [1, 11, 1], [1, 13, 2], [1, 16, 1], [1, 19, 1], [1, 26, 2], [1, 29, 1],
  [2, 2, 1], [2, 5, 1], [2, 10, 2], [2, 14, 1], [2, 17, 2], [2, 18, 1], [2, 20, 1], [2, 23, 1], [2, 24, 2], [2, 27, 1], [2, 28, 1],
  [3, 1, 1], [3, 4, 2], [3, 6, 2], [3, 9, 1], [3, 12, 1], [3, 15, 2], [3, 21, 1], [3, 25, 1], [3, 27, 2], [3, 28, 1], [3, 29, 2],
  // overlap tra sedi
  [0, 13, 1], [1, 0, 1], [2, 0, 1], [3, 6, 1], [0, 19, 1], [2, 3, 1],
];

async function main() {
  const pointIds: string[] = [];

  for (const bib of biblioteche) {
    let manager = await prisma.user.findUnique({ where: { email: bib.managerEmail } });
    if (!manager) {
      manager = await prisma.user.create({
        data: {
          email: bib.managerEmail,
          passwordHash: await hashPassword('LiberyDemo2026!'),
          displayName: `Gestore ${bib.name}`,
          role: 'point_manager',
        },
      });
    }

    const slug = bib.city.toLowerCase().replace(/\s+/g, '-');
    const existing = await prisma.point.findFirst({ where: { name: bib.name } });
    const point = existing
      ? await prisma.point.update({
          where: { id: existing.id },
          data: {
            type: 'biblioteca',
            status: 'approved',
            setupCompleted: true,
            address: bib.address,
            city: bib.city,
            latitude: bib.latitude,
            longitude: bib.longitude,
            description: bib.description,
            openingHours: bib.openingHours,
            managerId: manager.id,
          },
        })
      : await prisma.point.create({
          data: {
            name: bib.name,
            type: 'biblioteca',
            status: 'approved',
            setupCompleted: true,
            address: bib.address,
            city: bib.city,
            latitude: bib.latitude,
            longitude: bib.longitude,
            description: bib.description,
            openingHours: bib.openingHours,
            managerId: manager.id,
            approvedAt: new Date(),
            qrToken: `seed-bib-${slug}`,
          },
        });
    pointIds.push(point.id);
    console.log(`Biblioteca: ${bib.name} (${bib.city})`);
  }

  const bookIds: string[] = [];
  for (const libro of libri) {
    const book = await prisma.book.upsert({
      where: { isbn: libro.isbn },
      create: { ...libro, source: 'libery_db' },
      update: {
        title: libro.title,
        author: libro.author,
        publisher: libro.publisher,
        year: libro.year,
        genre: libro.genre,
        language: libro.language,
        pages: libro.pages,
        description: libro.description,
      },
    });
    bookIds.push(book.id);
  }
  console.log(`Libri in catalogo: ${libri.length}`);
  console.log('Recupero copertine (Google Books / Open Library)…');
  let covers = 0;
  for (const libro of libri) {
    const r = await resolveBookByIsbn(libro.isbn);
    if (r.ok && r.book.coverPath) covers++;
  }
  console.log(`  Copertine salvate in cover_path: ${covers}/${libri.length}`);

  let assegnazioni = 0;
  for (const [pi, bi, copies] of inventario) {
    const pointId = pointIds[pi];
    const bookId = bookIds[bi];
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
    assegnazioni++;
  }

  const totalCopies = inventario.reduce((s, [, , c]) => s + c, 0);
  console.log(`\nRiepilogo:`);
  console.log(`  Biblioteche: ${biblioteche.length}`);
  console.log(`  Titoli unici: ${libri.length}`);
  console.log(`  Righe inventario: ${assegnazioni}`);
  console.log(`  Copie totali disponibili: ${totalCopies}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
