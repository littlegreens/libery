import { Router } from 'express';
import { authenticate, requireRole } from '../../middleware/auth.js';
import usersRouter from './users.js';
import pointsRouter from './points.js';
import requestsRouter from './requests.js';

const router = Router();

router.use(authenticate, requireRole('admin'));

router.use('/users', usersRouter);
router.use('/points', pointsRouter);
router.use('/requests', requestsRouter);

router.get('/stats', async (_req, res, next) => {
  try {
    const { prisma } = await import('../../lib/prisma.js');
    const [users, points, pendingRequests, books] = await Promise.all([
      prisma.user.count(),
      prisma.point.count({ where: { status: 'approved' } }),
      prisma.pointRequest.count({ where: { status: 'pending' } }),
      prisma.book.count(),
    ]);
    res.json({ users, approvedPoints: points, pendingRequests, books });
  } catch (e) {
    next(e);
  }
});

export default router;
