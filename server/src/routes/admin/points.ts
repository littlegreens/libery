import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { hashPassword } from '../../lib/auth.js';
import { randomBytes } from 'node:crypto';

const router = Router();

const listQuerySchema = z.object({
  q: z.string().optional(),
  type: z.enum(['biblioteca', 'libreria', 'corner_free']).optional(),
  status: z.enum(['pending', 'approved', 'suspended']).optional(),
  city: z.string().optional(),
});

const createPointSchema = z.object({
  name: z.string().min(2),
  type: z.enum(['biblioteca', 'libreria', 'corner_free']),
  address: z.string().optional(),
  city: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  description: z.string().optional(),
  managerEmail: z.string().email().optional(),
  managerPassword: z.string().min(8).optional(),
  managerDisplayName: z.string().optional(),
  managerId: z.string().uuid().optional(),
});

router.get('/', async (req, res, next) => {
  try {
    const query = listQuerySchema.parse(req.query);
    const points = await prisma.point.findMany({
      where: {
        ...(query.status ? { status: query.status } : {}),
        ...(query.type ? { type: query.type } : {}),
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
      include: {
        manager: { select: { id: true, email: true, displayName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ points, total: points.length });
  } catch (e) {
    next(e);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const body = createPointSchema.parse(req.body);
    let managerId = body.managerId;

    if (!managerId && body.managerEmail) {
      const email = body.managerEmail.toLowerCase();
      let manager = await prisma.user.findUnique({ where: { email } });
      if (!manager) {
        const password = body.managerPassword ?? randomBytes(9).toString('base64url');
        manager = await prisma.user.create({
          data: {
            email,
            passwordHash: await hashPassword(password),
            displayName: body.managerDisplayName ?? body.name,
            role: 'point_manager',
          },
        });
      } else if (manager.role === 'user') {
        manager = await prisma.user.update({
          where: { id: manager.id },
          data: { role: 'point_manager' },
        });
      }
      managerId = manager.id;
    }

    const point = await prisma.point.create({
      data: {
        name: body.name,
        type: body.type,
        status: 'approved',
        setupCompleted: false,
        address: body.address,
        city: body.city,
        latitude: body.latitude,
        longitude: body.longitude,
        description: body.description,
        managerId,
        approvedAt: new Date(),
      },
      include: {
        manager: { select: { id: true, email: true, displayName: true } },
      },
    });

    res.status(201).json({ point });
  } catch (e) {
    next(e);
  }
});

router.put('/:id/status', async (req, res, next) => {
  try {
    const body = z
      .object({ status: z.enum(['pending', 'approved', 'suspended']) })
      .parse(req.body);

    const point = await prisma.point.update({
      where: { id: req.params.id },
      data: {
        status: body.status,
        ...(body.status === 'approved' ? { approvedAt: new Date() } : {}),
      },
      include: {
        manager: { select: { id: true, email: true, displayName: true } },
      },
    });
    res.json({ point });
  } catch (e) {
    next(e);
  }
});

export default router;
