/**
 * Associa gestore.anzio@libery.test alla Biblioteca Multimediale Chris Cappell Anzio.
 * Lancia con: npm run assign:manager:anzio
 */
import 'dotenv/config';
import { prisma } from '../lib/prisma.js';

const MANAGER_EMAIL = 'gestore.anzio@libery.test';
const POINT_QR_TOKEN = 'lazio-bib-anzio-cappell';

async function main() {
  const manager = await prisma.user.findUnique({ where: { email: MANAGER_EMAIL } });
  if (!manager) {
    console.error(`Utente non trovato: ${MANAGER_EMAIL}`);
    console.error('Lancia prima: npm run seed:users');
    process.exit(1);
  }
  if (manager.role !== 'point_manager') {
    console.error(`L'utente ${MANAGER_EMAIL} ha ruolo ${manager.role}, non point_manager`);
    process.exit(1);
  }

  const point = await prisma.point.findFirst({ where: { qrToken: POINT_QR_TOKEN } });
  if (!point) {
    console.error(`Punto non trovato (qrToken: ${POINT_QR_TOKEN})`);
    console.error('Lancia prima: npm run seed:lazio');
    process.exit(1);
  }

  await prisma.point.update({
    where: { id: point.id },
    data: { managerId: manager.id, setupCompleted: true },
  });

  console.log(`✓ Manager assegnato`);
  console.log(`  Punto  : ${point.name} (${point.city})`);
  console.log(`  Manager: ${manager.displayName} <${manager.email}>`);
  console.log(`  Login  : ${MANAGER_EMAIL} / LiberyDemo2026!`);
  console.log(`  Pagina : /gestore`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
