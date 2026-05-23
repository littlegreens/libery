import { prisma } from './prisma.js';
import { haversineKm } from './geo.js';

const DISCOVER_LIMIT = 3;
const NEARBY_START_KM = 5;

export type DiscoverBook = {
  id: string;
  isbn: string;
  title: string;
  author: string | null;
  year: number | null;
  genre: string | null;
  coverPath: string | null;
  availability: Array<{
    pointId: string;
    pointName: string;
    city: string | null;
    address: string | null;
    type: string;
    copies: number;
    latitude: number | null;
    longitude: number | null;
  }>;
  /** Solo sezione vicini: distanza minima in km dal punto più vicino con copie. */
  distanceKm?: number;
};

type BookWithAvailability = Awaited<ReturnType<typeof loadBooksWithAvailability>>[number];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function toDiscoverBook(
  row: BookWithAvailability,
  extra?: { distanceKm?: number },
): DiscoverBook {
  return {
    id: row.id,
    isbn: row.isbn,
    title: row.title,
    author: row.author,
    year: row.year,
    genre: row.genre,
    coverPath: row.coverPath,
    availability: row.pointBooks.map((pb) => ({
      pointId: pb.point.id,
      pointName: pb.point.name,
      city: pb.point.city,
      address: pb.point.address,
      type: pb.point.type,
      copies: pb.copies,
      latitude: pb.point.latitude,
      longitude: pb.point.longitude,
    })),
    ...extra,
  };
}

async function loadBooksWithAvailability(bookIds: string[]) {
  if (bookIds.length === 0) return [];
  return prisma.book.findMany({
    where: { id: { in: bookIds } },
    include: {
      pointBooks: {
        where: {
          copies: { gt: 0 },
          status: 'active',
          point: { status: 'approved' },
        },
        include: {
          point: {
            select: {
              id: true,
              name: true,
              city: true,
              address: true,
              type: true,
              latitude: true,
              longitude: true,
            },
          },
        },
      },
    },
  });
}

async function fillDiscoverBooks(ids: string[], distanceByBookId?: Map<string, number>): Promise<DiscoverBook[]> {
  const rows = await loadBooksWithAvailability(ids);
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids
    .map((id) => byId.get(id))
    .filter((r): r is BookWithAvailability => Boolean(r && r.pointBooks.length > 0))
    .map((r) => toDiscoverBook(r, distanceByBookId?.has(r.id) ? { distanceKm: distanceByBookId.get(r.id) } : undefined));
}

/** Libri con inventario e coordinate punto (per distanza). */
async function loadInventoryGeoRows() {
  const rows = await prisma.pointBook.findMany({
    where: {
      copies: { gt: 0 },
      status: 'active',
      point: {
        status: 'approved',
        latitude: { not: null },
        longitude: { not: null },
      },
    },
    select: {
      bookId: true,
      copies: true,
      point: {
        select: {
          id: true,
          latitude: true,
          longitude: true,
        },
      },
    },
  });
  return rows;
}

/**
 * Vicini: se ≥3 titoli entro 5 km → 3 a caso in quel raggio;
 * altrimenti i 3 titoli con distanza minima (raggio espanso implicitamente).
 */
export async function discoverNearby(lat?: number, lng?: number): Promise<{
  books: DiscoverBook[];
  radiusKm: number | null;
  usedGps: boolean;
}> {
  const geoRows = await loadInventoryGeoRows();
  if (geoRows.length === 0) {
    return { books: [], radiusKm: null, usedGps: false };
  }

  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    const bookIds = [...new Set(geoRows.map((r) => r.bookId))];
    const picked = shuffle(bookIds).slice(0, DISCOVER_LIMIT);
    return {
      books: await fillDiscoverBooks(picked),
      radiusKm: null,
      usedGps: false,
    };
  }

  const minDistByBook = new Map<string, number>();
  for (const row of geoRows) {
    const plat = row.point.latitude!;
    const plng = row.point.longitude!;
    const d = haversineKm(lat, lng, plat, plng);
    const prev = minDistByBook.get(row.bookId);
    if (prev === undefined || d < prev) minDistByBook.set(row.bookId, d);
  }

  const within5 = [...minDistByBook.entries()]
    .filter(([, d]) => d <= NEARBY_START_KM)
    .map(([bookId]) => bookId);

  let pickedIds: string[];
  let radiusKm: number;

  if (within5.length >= DISCOVER_LIMIT) {
    pickedIds = shuffle(within5).slice(0, DISCOVER_LIMIT);
    radiusKm = NEARBY_START_KM;
  } else {
    const sorted = [...minDistByBook.entries()].sort((a, b) => a[1] - b[1]);
    pickedIds = sorted.slice(0, DISCOVER_LIMIT).map(([id]) => id);
    const maxD = sorted.slice(0, DISCOVER_LIMIT).at(-1)?.[1];
    radiusKm = maxD != null ? Math.ceil(maxD) : NEARBY_START_KM;
  }

  const distMap = new Map(pickedIds.map((id) => [id, minDistByBook.get(id)!]));
  return {
    books: await fillDiscoverBooks(pickedIds, distMap),
    radiusKm,
    usedGps: true,
  };
}

export async function discoverTrending(): Promise<DiscoverBook[]> {
  const grouped = await prisma.transaction.groupBy({
    by: ['bookId'],
    _count: { _all: true },
    orderBy: { _count: { bookId: 'desc' } },
    take: DISCOVER_LIMIT,
  });

  let ids = grouped.map((g) => g.bookId);
  if (ids.length < DISCOVER_LIMIT) {
    const extra = await prisma.book.findMany({
      where: {
        id: { notIn: ids },
        pointBooks: {
          some: { copies: { gt: 0 }, status: 'active', point: { status: 'approved' } },
        },
      },
      take: DISCOVER_LIMIT - ids.length,
      orderBy: { title: 'asc' },
      select: { id: true },
    });
    ids = [...ids, ...extra.map((b) => b.id)];
  }

  return fillDiscoverBooks(ids.slice(0, DISCOVER_LIMIT));
}

export async function discoverLoved(): Promise<DiscoverBook[]> {
  const grouped = await prisma.userFavorite.groupBy({
    by: ['bookId'],
    _count: { _all: true },
    orderBy: { _count: { bookId: 'desc' } },
    take: DISCOVER_LIMIT,
  });

  let ids = grouped.map((g) => g.bookId);
  if (ids.length < DISCOVER_LIMIT) {
    const extra = await prisma.book.findMany({
      where: {
        id: { notIn: ids },
        pointBooks: {
          some: { copies: { gt: 0 }, status: 'active', point: { status: 'approved' } },
        },
      },
      take: DISCOVER_LIMIT - ids.length,
      orderBy: { title: 'asc' },
      select: { id: true },
    });
    ids = [...ids, ...extra.map((b) => b.id)];
  }

  return fillDiscoverBooks(ids.slice(0, DISCOVER_LIMIT));
}

export async function getDiscoverPayload(lat?: number, lng?: number) {
  const [nearby, trending, loved] = await Promise.all([
    discoverNearby(lat, lng),
    discoverTrending(),
    discoverLoved(),
  ]);

  return {
    nearby: nearby.books,
    nearbyMeta: { radiusKm: nearby.radiusKm, usedGps: nearby.usedGps },
    trending,
    loved,
  };
}
