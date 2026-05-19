import 'dotenv/config';
import { prisma } from '../lib/prisma.js';

/** Punti demo con coordinate per test mappa (Roma) */
const demos = [
  {
    name: 'Biblioteca Centrale Demo',
    type: 'biblioteca' as const,
    city: 'Roma',
    address: 'Piazza della Repubblica',
    latitude: 41.9028,
    longitude: 12.4964,
    description: 'Punto demo per test mappa Libery',
  },
  {
    name: 'Libreria Tra i Libri',
    type: 'libreria' as const,
    city: 'Roma',
    address: 'Via del Corso',
    latitude: 41.905,
    longitude: 12.482,
    description: 'Libreria indipendente — demo',
  },
  {
    name: 'Corner Free Trastevere',
    type: 'corner_free' as const,
    city: 'Roma',
    address: 'Piazza di Santa Maria',
    latitude: 41.8895,
    longitude: 12.4697,
    description: 'Scaffale libero gestito dalla community',
    qrToken: 'seed-corner-trastevere',
  },
];

async function main() {
  for (const d of demos) {
    const existing = await prisma.point.findFirst({
      where: { name: d.name },
    });
    if (existing) {
      await prisma.point.update({
        where: { id: existing.id },
        data: {
          ...d,
          status: 'approved',
          setupCompleted: true,
        },
      });
      console.log(`Aggiornato: ${d.name}`);
    } else {
      await prisma.point.create({
        data: {
          ...d,
          status: 'approved',
          setupCompleted: true,
          approvedAt: new Date(),
          ...(d.qrToken ? { qrToken: d.qrToken } : {}),
        },
      });
      console.log(`Creato: ${d.name}`);
    }
  }
  console.log('Punti demo pronti sulla mappa.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
