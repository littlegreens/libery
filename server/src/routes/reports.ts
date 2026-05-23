import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate, type AuthRequest } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

const bodySchema = z.object({
  pointId: z.string().uuid(),
  bookId: z.string().uuid(),
  type: z.enum(['missing', 'present']),
});

/** Segnalazione libro assente/presente (Corner Free: «Non c'è più»). */
router.post('/', async (req: AuthRequest, res, next) => {
  try {
    const { pointId, bookId, type } = bodySchema.parse(req.body);
    const userId = req.user!.sub;

    const point = await prisma.point.findUnique({ where: { id: pointId } });
    if (!point || point.status !== 'approved') {
      res.status(404).json({ error: 'Punto non trovato' });
      return;
    }
    if (point.type !== 'corner_free') {
      res.status(400).json({
        error: 'Le segnalazioni «non c\'è più» sono solo nei Corner Free. In biblioteca parla con l\'addetto.',
      });
      return;
    }

    const pointBook = await prisma.pointBook.findUnique({
      where: { pointId_bookId: { pointId, bookId } },
    });
    if (!pointBook) {
      res.status(404).json({ error: 'Libro non in inventario di questo punto' });
      return;
    }

    await prisma.$transaction([
      prisma.report.create({
        data: { userId, pointBookId: pointBook.id, type },
      }),
      prisma.pointBook.update({
        where: { id: pointBook.id },
        data: { copies: type === 'missing' ? 0 : Math.max(pointBook.copies, 1) },
      }),
    ]);

    res.json({
      ok: true,
      message:
        type === 'missing'
          ? 'Grazie: il libro non verrà più mostrato come disponibile qui.'
          : 'Segnalazione registrata.',
    });
  } catch (e) {
    next(e);
  }
});

export default router;
