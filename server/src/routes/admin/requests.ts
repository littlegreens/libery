import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { hashPassword } from '../../lib/auth.js';
import { randomBytes } from 'node:crypto';
import type { AuthRequest } from '../../middleware/auth.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const status = z
      .enum(['pending', 'approved', 'rejected'])
      .optional()
      .parse(req.query.status ?? 'pending');

    const requests = await prisma.pointRequest.findMany({
      where: { status: status ?? 'pending' },
      include: {
        requester: { select: { id: true, email: true, displayName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ requests, total: requests.length });
  } catch (e) {
    next(e);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const request = await prisma.pointRequest.findUnique({
      where: { id: req.params.id },
      include: {
        requester: { select: { id: true, email: true, displayName: true } },
      },
    });
    if (!request) {
      res.status(404).json({ error: 'Richiesta non trovata' });
      return;
    }
    res.json({ request });
  } catch (e) {
    next(e);
  }
});

const reviewSchema = z.object({
  adminNote: z.string().optional(),
  managerEmail: z.string().email().optional(),
  managerPassword: z.string().min(8).optional(),
});

router.post('/:id/approve', async (req: AuthRequest, res, next) => {
  try {
    const body = reviewSchema.parse(req.body);
    const pointRequest = await prisma.pointRequest.findUnique({
      where: { id: String(req.params.id) },
    });

    if (!pointRequest) {
      res.status(404).json({ error: 'Richiesta non trovata' });
      return;
    }
    if (pointRequest.status !== 'pending') {
      res.status(400).json({ error: 'Richiesta già elaborata' });
      return;
    }

    const managerEmail = (
      body.managerEmail ??
      pointRequest.contactEmail ??
      ''
    ).toLowerCase();

    if (!managerEmail) {
      res.status(400).json({
        error: 'Specificare managerEmail o contactEmail nella richiesta',
      });
      return;
    }

    const tempPassword = body.managerPassword ?? randomBytes(9).toString('base64url');

    let manager = await prisma.user.findUnique({ where: { email: managerEmail } });
    if (!manager) {
      manager = await prisma.user.create({
        data: {
          email: managerEmail,
          passwordHash: await hashPassword(tempPassword),
          displayName: pointRequest.name,
          role: 'point_manager',
          emailVerifiedAt: new Date(),
        },
      });
    } else if (manager.role === 'user') {
      manager = await prisma.user.update({
        where: { id: manager.id },
        data: { role: 'point_manager' },
      });
    }

    const [point, updatedRequest] = await prisma.$transaction([
      prisma.point.create({
        data: {
          name: pointRequest.name,
          type: pointRequest.pointType,
          status: 'approved',
          setupCompleted: false,
          address: pointRequest.address,
          city: pointRequest.city,
          description: pointRequest.description,
          managerId: manager.id,
          approvedAt: new Date(),
          approvedById: req.user!.sub,
        },
        include: {
          manager: { select: { id: true, email: true, displayName: true } },
        },
      }),
      prisma.pointRequest.update({
        where: { id: pointRequest.id },
        data: {
          status: 'approved',
          adminNote: body.adminNote,
          reviewedById: req.user!.sub,
          reviewedAt: new Date(),
        },
      }),
    ]);

    res.json({
      point,
      request: updatedRequest,
      managerCredentials: body.managerPassword
        ? undefined
        : { email: managerEmail, temporaryPassword: tempPassword },
    });
  } catch (e) {
    next(e);
  }
});

router.post('/:id/reject', async (req: AuthRequest, res, next) => {
  try {
    const body = z.object({ adminNote: z.string().min(1) }).parse(req.body);
    const pointRequest = await prisma.pointRequest.findUnique({
      where: { id: String(req.params.id) },
    });

    if (!pointRequest) {
      res.status(404).json({ error: 'Richiesta non trovata' });
      return;
    }
    if (pointRequest.status !== 'pending') {
      res.status(400).json({ error: 'Richiesta già elaborata' });
      return;
    }

    const request = await prisma.pointRequest.update({
      where: { id: pointRequest.id },
      data: {
        status: 'rejected',
        adminNote: body.adminNote,
        reviewedById: req.user!.sub,
        reviewedAt: new Date(),
      },
    });
    res.json({ request });
  } catch (e) {
    next(e);
  }
});

export default router;
