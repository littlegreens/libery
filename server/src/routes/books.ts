import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate, optionalAuthenticate, type AuthRequest } from '../middleware/auth.js';
import { isValidIsbnInput, normalizeIsbn } from '../lib/isbn.js';
import { isValidCoverUrl, pickCoverUrlSync } from '../lib/coverPick.js';
import { isTrustedDbBook } from '../lib/bookMetadataQuality.js';
import { findBookByIsbn, resolveBookByIsbn, toBookDto } from '../services/bookCatalog.js';
import type { BookDto } from '../services/bookCatalog.js';

function bookDtoWithCover(dto: BookDto): BookDto {
  const coverPath = isValidCoverUrl(dto.coverPath)
    ? dto.coverPath
    : pickCoverUrlSync(null, null, dto.isbn);
  return { ...dto, coverPath };
}

const router = Router();

router.get('/search', async (req, res, next) => {
  try {
    const { q } = z.object({ q: z.string().min(1) }).parse(req.query);

    const books = await prisma.book.findMany({
      where: {
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { author: { contains: q, mode: 'insensitive' } },
          { isbn: { contains: q } },
        ],
      },
      take: 40,
      orderBy: { title: 'asc' },
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

    res.json({
      books: books.map((b) => ({
        id: b.id,
        isbn: b.isbn,
        title: b.title,
        author: b.author,
        year: b.year,
        genre: b.genre,
        publisher: b.publisher,
        description: b.description,
        coverPath: b.coverPath,
        source: b.source,
        availability: b.pointBooks.map((pb) => ({
          pointId: pb.point.id,
          pointName: pb.point.name,
          city: pb.point.city,
          address: pb.point.address,
          type: pb.point.type,
          copies: pb.copies,
          latitude: pb.point.latitude,
          longitude: pb.point.longitude,
        })),
      })),
      total: books.length,
    });
  } catch (e) {
    next(e);
  }
});

router.post('/import', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { isbn: raw } = z.object({ isbn: z.string().min(10).max(20) }).parse(req.body);
    if (!isValidIsbnInput(raw)) {
      res.status(400).json({ error: 'ISBN non valido' });
      return;
    }

    const resolved = await resolveBookByIsbn(raw);
    if (!resolved.ok) {
      res.status(404).json({
        error: 'Libro non riconosciuto. Controlla l\'ISBN o riprova.',
        isbn: normalizeIsbn(raw),
        attempts: resolved.attempts,
      });
      return;
    }

    res.status(resolved.created ? 201 : 200).json({
      book: bookDtoWithCover(toBookDto(resolved.book)),
      created: resolved.created,
      source: resolved.book.source,
      provider: resolved.provider ?? 'db',
      fieldsUpdated: resolved.fieldsUpdated,
      attempts: resolved.attempts,
    });
  } catch (e) {
    next(e);
  }
});

router.get('/isbn/:isbn', async (req, res, next) => {
  try {
    const raw = req.params.isbn;
    if (!isValidIsbnInput(raw)) {
      res.status(400).json({ error: 'ISBN non valido' });
      return;
    }

    const fetchExternal = req.query.fetch !== 'db';
    const debug = req.query.debug === '1' || req.query.debug === 'true';

    if (!fetchExternal) {
      const book = await findBookByIsbn(raw);
      if (!book || !isTrustedDbBook(book)) {
        res.status(404).json({ error: 'Libro non in catalogo', isbn: normalizeIsbn(raw) });
        return;
      }
      res.json({ book: bookDtoWithCover(toBookDto(book)), source: book.source, created: false });
      return;
    }

    const isbnNorm = normalizeIsbn(raw) ?? raw;
    const hasGoogleKey = Boolean(process.env.GOOGLE_BOOKS_API_KEY?.trim());

    const resolved = await resolveBookByIsbn(raw);
    if (!resolved.ok) {
      res.status(404).json({
        error: 'Libro non riconosciuto. Controlla l\'ISBN o riprova.',
        isbn: isbnNorm,
        attempts: resolved.attempts,
        ...(debug
          ? {
              debug: {
                googleBooksConfigured: hasGoogleKey,
                hint: hasGoogleKey
                  ? undefined
                  : 'Imposta GOOGLE_BOOKS_API_KEY in server/.env per copertine Google Books',
              },
            }
          : {}),
      });
      return;
    }

    const provider = resolved.provider ?? 'db';
    const book = bookDtoWithCover(toBookDto(resolved.book));

    const payload: Record<string, unknown> = {
      book,
      source: resolved.book.source,
      created: resolved.created,
      provider,
      fromCache: resolved.fromCache ?? false,
      fieldsUpdated: resolved.fieldsUpdated,
      attempts: resolved.attempts,
    };

    if (debug && resolved.sourceSnapshots) {
      payload.debug = {
        googleBooksConfigured: hasGoogleKey,
        coverInDb: Boolean(resolved.book.coverPath?.trim()),
        coverSentToClient: Boolean(book.coverPath?.trim()),
        coverFallbackUsed: !resolved.book.coverPath?.trim() && Boolean(book.coverPath?.trim()),
        sources: resolved.sourceSnapshots,
      };
    }

    res.json(payload);
  } catch (e) {
    next(e);
  }
});

router.get('/:id', optionalAuthenticate, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user?.sub;
    const book = await prisma.book.findUnique({
      where: { id: req.params.id },
      include: {
        pointBooks: {
          where: {
            copies: { gt: 0 },
            status: 'active',
            point: { status: 'approved' },
          },
          include: {
            point: {
              select: { id: true, name: true, city: true, type: true, address: true, latitude: true, longitude: true },
            },
          },
        },
      },
    });
    if (!book) {
      res.status(404).json({ error: 'Libro non trovato' });
      return;
    }

    let isFavorite = false;
    if (userId) {
      const fav = await prisma.userFavorite.findUnique({
        where: { userId_bookId: { userId, bookId: book.id } },
        select: { userId: true },
      });
      isFavorite = Boolean(fav);
    }

    res.json({ book: { ...book, isFavorite } });
  } catch (e) {
    next(e);
  }
});

export default router;
