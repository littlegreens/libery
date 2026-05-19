import './loadEnv.js';
import {
  QUEUE_NAMES,
  Worker,
  getRedisConnection,
  ensureMidnightResetSchedule,
  type AeroplaniniTrigger,
  type ReservationExpireJob,
} from './lib/queue.js';
import { runMidnightReset } from './jobs/midnightReset.js';
import { runReservationExpire } from './jobs/reservationExpire.js';
import { runAeroplaniniCheck } from './jobs/aeroplaniniCheck.js';

const connection = getRedisConnection();

const workers = [
  new Worker(
    QUEUE_NAMES.midnightReset,
    async () => {
      const out = await runMidnightReset();
      console.log(`[midnight-reset] utenti azzerati: ${out.usersReset}`);
      return out;
    },
    { connection },
  ),
  new Worker<ReservationExpireJob>(
    QUEUE_NAMES.reservationExpire,
    async (job) => {
      const out = await runReservationExpire(job.data.reservationId);
      console.log(`[reservation-expire] ${job.data.reservationId} -> ${out.status}`);
      return out;
    },
    { connection },
  ),
  new Worker<AeroplaniniTrigger>(
    QUEUE_NAMES.aeroplaniniCheck,
    async (job) => {
      const earned = await runAeroplaniniCheck(job.data);
      if (earned.length > 0) {
        console.log(`[aeroplanini] ${job.data.userId} -> ${earned.join(', ')}`);
      }
      return { earned };
    },
    { connection },
  ),
];

await ensureMidnightResetSchedule();
console.log('[queue] cron midnight-reset registrato (Europe/Rome 00:00)');

for (const w of workers) {
  w.on('failed', (job, err) => {
    console.error(`[worker:${w.name}] job ${job?.id} fallito:`, err.message);
  });
}

console.log(`[worker] in ascolto su ${workers.length} code`);

async function shutdown(signal: string) {
  console.log(`[worker] ricevuto ${signal}, chiudo…`);
  await Promise.all(workers.map((w) => w.close()));
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
