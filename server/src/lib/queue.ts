import { Queue, QueueEvents, Worker, type ConnectionOptions } from 'bullmq';
import { Redis } from 'ioredis';

/**
 * Connessione Redis condivisa per BullMQ.
 * BullMQ richiede `maxRetriesPerRequest: null` su connessioni usate dai worker.
 */
function buildRedisConnection(): ConnectionOptions {
  const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
  const client = new Redis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
  client.on('error', (err: Error) => {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[redis] errore:', err.message);
    }
  });
  return client;
}

let _connection: ConnectionOptions | null = null;
export function getRedisConnection(): ConnectionOptions {
  if (!_connection) _connection = buildRedisConnection();
  return _connection;
}

// ---------- Code ----------

export const QUEUE_NAMES = {
  midnightReset: 'libery-midnight-reset',
  reservationExpire: 'libery-reservation-expire',
  aeroplaniniCheck: 'libery-aeroplanini-check',
} as const;

export type AeroplaniniTrigger = {
  userId: string;
  reason: 'leave' | 'take' | 'report' | 'visit';
  context?: {
    pointId?: string;
    bookId?: string;
  };
};

export type ReservationExpireJob = {
  reservationId: string;
};

let _midnightQueue: Queue | null = null;
let _reservationQueue: Queue<ReservationExpireJob> | null = null;
let _aeroplaniniQueue: Queue<AeroplaniniTrigger> | null = null;

export function midnightResetQueue() {
  if (!_midnightQueue) {
    _midnightQueue = new Queue(QUEUE_NAMES.midnightReset, {
      connection: getRedisConnection(),
    });
  }
  return _midnightQueue;
}

export function reservationExpireQueue() {
  if (!_reservationQueue) {
    _reservationQueue = new Queue<ReservationExpireJob>(QUEUE_NAMES.reservationExpire, {
      connection: getRedisConnection(),
    });
  }
  return _reservationQueue;
}

export function aeroplaniniCheckQueue() {
  if (!_aeroplaniniQueue) {
    _aeroplaniniQueue = new Queue<AeroplaniniTrigger>(QUEUE_NAMES.aeroplaniniCheck, {
      connection: getRedisConnection(),
    });
  }
  return _aeroplaniniQueue;
}

// ---------- Helpers schedulazione ----------

/**
 * Registra/aggiorna la repeatable di reset mezzanotte (Europe/Rome).
 * Idempotente: se già esiste, BullMQ non duplica.
 */
export async function ensureMidnightResetSchedule(): Promise<void> {
  const q = midnightResetQueue();
  await q.add(
    'midnight-reset',
    {},
    {
      repeat: {
        pattern: '0 0 * * *',
        tz: 'Europe/Rome',
      },
      jobId: 'midnight-reset-cron',
      removeOnComplete: 50,
      removeOnFail: 50,
    },
  );
}

/**
 * Pianifica l'expire di una prenotazione `delayMs` ms da ora.
 */
export async function scheduleReservationExpire(
  reservationId: string,
  delayMs: number,
): Promise<void> {
  const q = reservationExpireQueue();
  await q.add(
    'expire',
    { reservationId },
    {
      delay: Math.max(0, delayMs),
      jobId: `reservation-expire-${reservationId}`,
      removeOnComplete: 100,
      removeOnFail: 100,
    },
  );
}

/**
 * Pianifica il check Aeroplanini dopo un'azione utente.
 */
export async function triggerAeroplaniniCheck(trigger: AeroplaniniTrigger): Promise<void> {
  const q = aeroplaniniCheckQueue();
  await q.add('check', trigger, {
    removeOnComplete: 100,
    removeOnFail: 100,
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
  });
}

// ---------- Esporti utili per worker.ts ----------

export { Worker, QueueEvents };
