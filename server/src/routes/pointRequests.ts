import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate, type AuthRequest } from '../middleware/auth.js';
import { isEmailVerified } from '../lib/emailVerification.js';
import { pointRequestBodySchema, pointRequestToDb } from '../lib/pointRequestSchema.js';

const router = Router();

router.post('/', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const body = pointRequestBodySchema.parse(req.body);
    const requester = await prisma.user.findUnique({
      where: { id: req.user!.sub },
      select: { id: true, email: true, emailVerifiedAt: true },
    });
    if (!requester) {
      res.status(401).json({ error: 'Utente non trovato' });
      return;
    }
    if (!isEmailVerified(requester)) {
      res.status(403).json({
        error: 'Verifica la tua email prima di proporre un punto libery',
        code: 'EMAIL_NOT_VERIFIED',
      });
      return;
    }

    const pending = await prisma.pointRequest.count({
      where: { requesterId: requester.id, status: 'pending' },
    });
    if (pending >= 3) {
      res.status(409).json({ error: 'Hai già richieste in attesa. Attendi la risposta dell\'admin.' });
      return;
    }

    const pr = pointRequestToDb(body);
    const request = await prisma.pointRequest.create({
      data: {
        requesterId: requester.id,
        pointType: pr.pointType,
        name: pr.name,
        address: pr.address,
        city: pr.city,
        latitude: pr.latitude,
        longitude: pr.longitude,
        contactEmail: requester.email,
        contactPhone: pr.contactPhone,
        notes: pr.notes,
      },
    });

    res.status(201).json({ request });
  } catch (e) {
    next(e);
  }
});

router.get('/mine', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const requests = await prisma.pointRequest.findMany({
      where: { requesterId: req.user!.sub },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ requests });
  } catch (e) {
    next(e);
  }
});

export default router;
