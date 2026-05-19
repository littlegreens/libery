import { Router } from 'express';
import { z } from 'zod';
import { openLibraryCoverByIsbn } from '../lib/bookMetadataMerge.js';
import { prisma } from '../lib/prisma.js';
import { resolveBookByIsbn } from '../services/bookCatalog.js';
import type { PointStatus, PointType } from '@prisma/client';

const router = Router();

const listQuerySchema = z.object({
  q: z.string().optional(),
  type: z.enum(['biblioteca', 'libreria', 'corner_free']).optional(),
  status: z.enum(['pending', 'approved', 'suspended']).optional(),
  city: z.string().optional(),
  lat: z.coerce.number().optional(),
  lng: z.coerce.number().optional(),
  radiusKm: z.coerce.number().min(0.1).max(100).optional(),
});

router.get('/', async (req, res, next) => {
  try {
    const query = listQuerySchema.parse(req.query);
    const status = (query.status ?? 'approved') as PointStatus;

    const points = await prisma.point.findMany({
      where: {
        status,
        ...(query.type ? { type: query.type as PointType } : {}),
        ...(query.city ? { city: { contains: query.city, mode: 'insensitive' } } : {}),
        ...(query.q
          ? {
              OR: [
                { name: { contains: query.q, mode: 'insensitive' } },
                { address: { contains: query.q, mode: 'insensitive' } },
                { city: { contains: query.q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        name: true,
        type: true,
        status: true,
        address: true,
        city: true,
        latitude: true,
        longitude: true,
        description: true,
        photoUrl: true,
        setupCompleted: true,
      },
      orderBy: { name: 'asc' },
    });

    let result = points;
    if (query.lat != null && query.lng != null && query.radiusKm) {
      result = points.filter((p) => {
        if (p.latitude == null || p.longitude == null) return false;
        const d = haversineKm(query.lat!, query.lng!, p.latitude, p.longitude);
        return d <= query.radiusKm!;
      });
    }

    res.json({ points: result, total: result.length });
  } catch (e) {
    next(e);
  }
});

router.get('/qr/:token', async (req, res, next) => {
  try {
    const point = await prisma.point.findUnique({
      where: { qrToken: req.params.token },
      select: {
        id: true,
        name: true,
        type: true,
        status: true,
        address: true,
        city: true,
        latitude: true,
        longitude: true,
        description: true,
        photoUrl: true,
      },
    });
    if (!point || point.status !== 'approved') {
      res.status(404).json({ error: 'Cartello non riconosciuto' });
      return;
    }
    res.json({ point });
  } catch (e) {
    next(e);
  }
});

router.get('/:id/availability/:isbn', async (req, res, next) => {
  try {
    const { normalizeIsbn } = await import('../lib/isbn.js');
    const isbn = normalizeIsbn(req.params.isbn);
    if (!isbn) {
      res.status(400).json({ error: 'ISBN non valido' });
      return;
    }

    const point = await prisma.point.findUnique({
      where: { id: req.params.id },
      select: { id: true, name: true, status: true },
    });
    if (!point || point.status !== 'approved') {
      res.status(404).json({ error: 'Punto non valido' });
      return;
    }

    const book = await prisma.book.findUnique({ where: { isbn } });
    if (!book) {
      res.json({
        available: false,
        copies: 0,
        inCatalog: false,
        book: null,
        message: 'Libro non presente in questo punto',
      });
      return;
    }

    const pointBook = await prisma.pointBook.findUnique({
      where: { pointId_bookId: { pointId: point.id, bookId: book.id } },
    });

    const copies = pointBook?.copies ?? 0;
    res.json({
      available: copies > 0,
      copies,
      inCatalog: true,
      book: {
        id: book.id,
        isbn: book.isbn,
        title: book.title,
        author: book.author,
        year: book.year,
        coverPath: book.coverPath,
      },
      message:
        copies > 0
          ? `${copies} ${copies === 1 ? 'copia disponibile' : 'copie disponibili'}`
          : 'Non disponibile in questa biblioteca',
    });
  } catch (e) {
    next(e);
  }
});

router.get('/:id/books', async (req, res, next) => {
  try {
    const point = await prisma.point.findUnique({
      where: { id: req.params.id },
      select: { id: true, name: true, status: true },
    });
    if (!point || point.status !== 'approved') {
      res.status(404).json({ error: 'Punto non trovato' });
      return;
    }

    let inventory = await prisma.pointBook.findMany({
      where: {
        pointId: point.id,
        status: 'active',
        copies: { gt: 0 },
      },
      include: {
        book: {
          select: {
            id: true,
            isbn: true,
            title: true,
            author: true,
            year: true,
            genre: true,
            language: true,
            pages: true,
            description: true,
            coverPath: true,
          },
        },
      },
      orderBy: { book: { title: 'asc' } },
    });

    const missingCover = inventory.filter((row) => !row.book.coverPath).slice(0, 6);
    if (missingCover.length > 0) {
      await Promise.allSettled(missingCover.map((row) => resolveBookByIsbn(row.book.isbn)));
      inventory = await prisma.pointBook.findMany({
        where: {
          pointId: point.id,
          status: 'active',
          copies: { gt: 0 },
        },
        include: {
          book: {
            select: {
              id: true,
              isbn: true,
              title: true,
              author: true,
              year: true,
              genre: true,
              language: true,
              pages: true,
              description: true,
              coverPath: true,
            },
          },
        },
        orderBy: { book: { title: 'asc' } },
      });
    }

    res.json({
      pointId: point.id,
      books: inventory.map((row) => ({
        id: row.book.id,
        isbn: row.book.isbn,
        title: row.book.title,
        author: row.book.author,
        year: row.book.year,
        genre: row.book.genre,
        language: row.book.language,
        pages: row.book.pages,
        description: row.book.description,
        coverPath: row.book.coverPath ?? openLibraryCoverByIsbn(row.book.isbn),
        copies: row.copies,
      })),
      total: inventory.length,
    });
  } catch (e) {
    next(e);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const point = await prisma.point.findUnique({
      where: { id: req.params.id },
      include: {
        manager: { select: { id: true, displayName: true, email: true } },
      },
    });
    if (!point) {
      res.status(404).json({ error: 'Punto non trovato' });
      return;
    }
    res.json({ point });
  } catch (e) {
    next(e);
  }
});

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default router;
