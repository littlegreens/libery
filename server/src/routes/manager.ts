import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireRole, type AuthRequest } from '../middleware/auth.js';

const router = Router();

router.use(authenticate, requireRole('point_manager', 'admin'));

/**
 * Sezione "Il mio punto" — dati base del punto gestito.
 * NB: la "coda validazione" non esiste più: in v3 il flusso Lascia in Punto Certificato
 * si conclude col tasto "Ricevuto" dello scan QR (vedi /api/manager/scan).
 */
router.get('/point', async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.sub;
    const isAdmin = req.user!.role === 'admin';

    const point = await prisma.point.findFirst({
      where: isAdmin ? { status: 'approved' } : { managerId: userId, status: 'approved' },
      orderBy: { name: 'asc' },
    });

    if (!point) {
      res.status(404).json({ error: 'Nessun punto assegnato al tuo account' });
      return;
    }

    res.json({
      point: {
        id: point.id,
        name: point.name,
        city: point.city,
        type: point.type,
      },
    });
  } catch (e) {
    next(e);
  }
});

export default router;
