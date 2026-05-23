import { Router } from 'express';
import { z } from 'zod';
import { randomBytes } from 'node:crypto';
import { prisma } from '../lib/prisma.js';
import { hashPassword } from '../lib/auth.js';
import { authenticate, requireRole, type AuthRequest } from '../middleware/auth.js';
import { confirmManagerScan, previewManagerScan } from '../lib/managerScan.js';
import { resolveOperatorPoint } from '../lib/pointAccess.js';
import { sendMail } from '../lib/email.js';
import { resolveBookByIsbn } from '../services/bookCatalog.js';

const router = Router();

router.use(authenticate, requireRole('point_manager', 'point_staff', 'admin'));

router.get('/point', async (req: AuthRequest, res, next) => {
  try {
    const point = await resolveOperatorPoint(req.user!.sub, req.user!.role);
    if (!point) {
      res.status(404).json({ error: 'Nessun punto assegnato al tuo account' });
      return;
    }
    res.json({
      point: {
        id: point.id,
        name: point.name,
        city: point.city,
        address: point.address,
        type: point.type,
        isManager: point.managerId === req.user!.sub,
      },
    });
  } catch (e) {
    next(e);
  }
});

const scanBodySchema = z.object({
  qr: z.string().min(5).max(200),
});

const confirmBodySchema = z.object({
  action: z.enum(['leave', 'pickup']),
  isbn: z.string().min(10).max(20),
  userId: z.string().uuid(),
});

router.post('/scan', async (req: AuthRequest, res, next) => {
  try {
    const { qr } = scanBodySchema.parse(req.body);
    const result = await previewManagerScan(req.user!.sub, req.user!.role, qr);
    if ('error' in result) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.json({ preview: result });
  } catch (e) {
    next(e);
  }
});

router.post('/scan/confirm', async (req: AuthRequest, res, next) => {
  try {
    const { action, isbn, userId } = confirmBodySchema.parse(req.body);
    const result = await confirmManagerScan(req.user!.sub, req.user!.role, action, isbn, userId);
    if ('error' in result) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.json(result);
  } catch (e) {
    next(e);
  }
});

// ─── Inventario libri ─────────────────────────────────────────────────────────

router.get('/books', async (req: AuthRequest, res, next) => {
  try {
    const point = await resolveOperatorPoint(req.user!.sub, req.user!.role);
    if (!point) {
      res.status(404).json({ error: 'Nessun punto assegnato' });
      return;
    }
    const rows = await prisma.pointBook.findMany({
      where: { pointId: point.id, status: 'active' },
      include: {
        book: { select: { id: true, isbn: true, title: true, author: true, coverPath: true } },
      },
      orderBy: { book: { title: 'asc' } },
    });
    res.json({
      books: rows.map((r) => ({
        pointBookId: r.id,
        bookId: r.book.id,
        isbn: r.book.isbn,
        title: r.book.title,
        author: r.book.author,
        coverPath: r.book.coverPath,
        copies: r.copies,
      })),
    });
  } catch (e) {
    next(e);
  }
});

const copiesSchema = z.object({ copies: z.number().int().min(0).max(999) });

router.patch('/books/:bookId', async (req: AuthRequest, res, next) => {
  try {
    const point = await resolveOperatorPoint(req.user!.sub, req.user!.role);
    if (!point) {
      res.status(404).json({ error: 'Nessun punto assegnato' });
      return;
    }
    const { copies } = copiesSchema.parse(req.body);
    const bookId = String(req.params.bookId);
    const pb = await prisma.pointBook.findUnique({
      where: { pointId_bookId: { pointId: point.id, bookId } },
    });
    if (!pb) {
      res.status(404).json({ error: 'Libro non trovato nel punto' });
      return;
    }
    await prisma.pointBook.update({
      where: { id: pb.id },
      data: { copies, status: copies === 0 ? 'removed' : 'active' },
    });
    res.json({ copies });
  } catch (e) {
    next(e);
  }
});

router.delete('/books/:bookId', async (req: AuthRequest, res, next) => {
  try {
    const point = await resolveOperatorPoint(req.user!.sub, req.user!.role);
    if (!point) {
      res.status(404).json({ error: 'Nessun punto assegnato' });
      return;
    }
    const bookId = String(req.params.bookId);
    const pb = await prisma.pointBook.findUnique({
      where: { pointId_bookId: { pointId: point.id, bookId } },
    });
    if (!pb) {
      res.status(404).json({ error: 'Libro non trovato nel punto' });
      return;
    }
    await prisma.pointBook.update({
      where: { id: pb.id },
      data: { copies: 0, status: 'removed' },
    });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

const addBookSchema = z.object({ isbn: z.string().min(10).max(13) });

router.post('/add-book', async (req: AuthRequest, res, next) => {
  try {
    const point = await resolveOperatorPoint(req.user!.sub, req.user!.role);
    if (!point) {
      res.status(404).json({ error: 'Nessun punto assegnato' });
      return;
    }
    const { isbn } = addBookSchema.parse(req.body);
    const resolved = await resolveBookByIsbn(isbn);
    if (!resolved.ok) {
      res.status(404).json({ error: 'Libro non trovato nelle fonti esterne. Verifica l\'ISBN.' });
      return;
    }
    const book = resolved.book;
    const existing = await prisma.pointBook.findUnique({
      where: { pointId_bookId: { pointId: point.id, bookId: book.id } },
    });
    if (existing) {
      const newCopies = existing.copies + 1;
      await prisma.pointBook.update({
        where: { id: existing.id },
        data: { copies: newCopies, status: 'active' },
      });
      res.json({
        book: { id: book.id, isbn: book.isbn, title: book.title, author: book.author, coverPath: book.coverPath },
        copies: newCopies,
        added: false,
      });
    } else {
      await prisma.pointBook.create({
        data: {
          pointId: point.id,
          bookId: book.id,
          copies: 1,
          status: 'active',
          firstAddedAt: new Date(),
        },
      });
      res.status(201).json({
        book: { id: book.id, isbn: book.isbn, title: book.title, author: book.author, coverPath: book.coverPath },
        copies: 1,
        added: true,
      });
    }
  } catch (e) {
    next(e);
  }
});

// ─── Staff ────────────────────────────────────────────────────────────────────

/** Solo il responsabile del punto può gestire gli addetti. */
router.get('/staff', requireRole('point_manager', 'admin'), async (req: AuthRequest, res, next) => {
  try {
    const point = await resolveOperatorPoint(req.user!.sub, req.user!.role);
    if (!point) {
      res.status(404).json({ error: 'Nessun punto assegnato' });
      return;
    }
    const staff = await prisma.pointStaff.findMany({
      where: { pointId: point.id },
      include: {
        user: { select: { id: true, email: true, displayName: true, role: true, isActive: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ staff });
  } catch (e) {
    next(e);
  }
});

const addStaffSchema = z.object({
  email: z.string().email(),
  displayName: z.string().min(2).max(80).optional(),
});

router.post('/staff', requireRole('point_manager', 'admin'), async (req: AuthRequest, res, next) => {
  try {
    const body = addStaffSchema.parse(req.body);
    const email = body.email.toLowerCase();
    const point = await prisma.point.findFirst({
      where:
        req.user!.role === 'admin'
          ? { status: 'approved' }
          : { managerId: req.user!.sub, status: 'approved' },
      orderBy: { name: 'asc' },
    });
    if (!point) {
      res.status(404).json({ error: 'Nessun punto da gestire' });
      return;
    }

    let user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      if (user.role === 'admin') {
        res.status(400).json({ error: 'Non puoi aggiungere un amministratore come addetto' });
        return;
      }
      if (user.role === 'point_manager' && user.id !== point.managerId) {
        res.status(400).json({ error: 'Questo utente è responsabile di un altro punto' });
        return;
      }
      if (user.id === point.managerId) {
        res.status(400).json({ error: 'Il responsabile non va elencato come addetto' });
        return;
      }
    } else {
      const tempPassword = randomBytes(9).toString('base64url');
      user = await prisma.user.create({
        data: {
          email,
          passwordHash: await hashPassword(tempPassword),
          displayName: body.displayName?.trim(),
          role: 'point_staff',
          emailVerifiedAt: new Date(),
        },
      });
      await sendMail({
        to: email,
        subject: 'Sei addetto Libery — credenziali',
        text: [
          `Sei stato abilitato come addetto per "${point.name}".`,
          '',
          `Email: ${email}`,
          `Password temporanea: ${tempPassword}`,
          '',
          'Accedi all\'app Libery e cambia la password dal profilo quando possibile.',
        ].join('\n'),
      });
    }

    const existing = await prisma.pointStaff.findUnique({
      where: { pointId_userId: { pointId: point.id, userId: user.id } },
    });
    if (existing) {
      res.status(409).json({ error: 'Utente già addetto a questo punto' });
      return;
    }

    if (user.role === 'user') {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { role: 'point_staff' },
      });
    }

    await prisma.pointStaff.create({
      data: { pointId: point.id, userId: user.id, addedById: req.user!.sub },
    });

    const row = await prisma.pointStaff.findFirst({
      where: { pointId: point.id, userId: user.id },
      include: {
        user: { select: { id: true, email: true, displayName: true, role: true } },
      },
    });

    res.status(201).json({ staff: row });
  } catch (e) {
    next(e);
  }
});

router.delete('/staff/:userId', requireRole('point_manager', 'admin'), async (req: AuthRequest, res, next) => {
  try {
    const staffUserId = String(req.params.userId);
    const point = await prisma.point.findFirst({
      where:
        req.user!.role === 'admin'
          ? { status: 'approved' }
          : { managerId: req.user!.sub, status: 'approved' },
    });
    if (!point) {
      res.status(404).json({ error: 'Nessun punto da gestire' });
      return;
    }

    const row = await prisma.pointStaff.findUnique({
      where: { pointId_userId: { pointId: point.id, userId: staffUserId } },
    });
    if (!row) {
      res.status(404).json({ error: 'Addetto non trovato su questo punto' });
      return;
    }

    await prisma.pointStaff.delete({ where: { id: row.id } });

    const otherPoints = await prisma.pointStaff.count({ where: { userId: staffUserId } });
    if (otherPoints === 0) {
      await prisma.user.updateMany({
        where: { id: staffUserId, role: 'point_staff' },
        data: { role: 'user' },
      });
    }

    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;
