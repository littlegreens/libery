/**
 * Assegna i responsabili demo ai punti Lazio già creati.
 * Lancia con: npx tsx src/scripts/assign-managers.ts
 */
import 'dotenv/config';
import { prisma } from '../lib/prisma.js';

const assignments = [
  { email: 'biblio.gestore@libery.test',       qrToken: 'lazio-bib-mentana' },
  { email: 'gestore.alessandrina@libery.test',  qrToken: 'lazio-bib-tivoli-coccanari' },
  { email: 'gestore.anzio@libery.test',         qrToken: 'lazio-bib-anzio-cappell' },
];

async function main() {
  for (const { email, qrToken } of assignments) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) { console.log(`  SKIP (utente non trovato): ${email}`); continue; }

    const pt = await prisma.point.findFirst({ where: { qrToken } });
    if (!pt) { console.log(`  SKIP (punto non trovato: ${qrToken})`); continue; }

    if (pt.managerId && pt.managerId !== user.id) {
      console.log(`  SKIP (${pt.name} ha già un altro responsabile)`);
      continue;
    }

    await prisma.point.update({
      where: { id: pt.id },
      data: { managerId: user.id, setupCompleted: true },
    });

    if (user.role !== 'point_manager') {
      await prisma.user.update({ where: { id: user.id }, data: { role: 'point_manager' } });
    }

    console.log(`  ✓ ${user.displayName ?? email}  →  ${pt.name} (${pt.city})`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
