import './loadEnv.js';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { prisma } from './lib/prisma.js';
import { errorHandler } from './middleware/errorHandler.js';
import authRouter from './routes/auth.js';
import pointsRouter from './routes/points.js';
import booksRouter from './routes/books.js';
import userRouter from './routes/user.js';
import transactionsRouter from './routes/transactions.js';
import reservationsRouter from './routes/reservations.js';
import adminRouter from './routes/admin/index.js';
import managerRouter from './routes/manager.js';
import notificationsRouter from './routes/notifications.js';

const app = express();
const port = Number(process.env.PORT) || 3001;

app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_URL ?? 'http://localhost:5173',
    credentials: true,
  }),
);
app.use(express.json());

if (process.env.NODE_ENV !== 'production') {
  app.use((req, _res, next) => {
    if (req.path.startsWith('/api')) {
      console.log(`[http] ${req.method} ${req.path}`);
    }
    next();
  });
}

app.get('/api/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      ok: true,
      service: 'libery-api',
      database: 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      ok: false,
      service: 'libery-api',
      database: 'disconnected',
      error: error instanceof Error ? error.message : 'unknown',
    });
  }
});

app.get('/api', (_req, res) => {
  res.json({ name: 'Libery API', version: '0.2.0', docs: 'BRAIN.md' });
});

app.use('/api/auth', authRouter);
app.use('/api/points', pointsRouter);
app.use('/api/books', booksRouter);
app.use('/api/user', userRouter);
app.use('/api/transactions', transactionsRouter);
app.use('/api/reservations', reservationsRouter);
app.use('/api/admin', adminRouter);
app.use('/api/manager', managerRouter);
app.use('/api/notifications', notificationsRouter);

app.use(errorHandler);

app.listen(port, () => {
  console.log(`Libery API in ascolto su http://localhost:${port}`);
});
