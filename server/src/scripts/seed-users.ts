import 'dotenv/config';
import { prisma } from '../lib/prisma.js';
import { hashPassword } from '../lib/auth.js';

const DEMO_PASSWORD = 'LiberyDemo2026!';

const accounts = [
  {
    email: (process.env.ADMIN_EMAIL ?? 'admin@libery.app').toLowerCase(),
    password: process.env.ADMIN_PASSWORD ?? '123456789',
    displayName: process.env.ADMIN_DISPLAY_NAME ?? 'Admin Libery',
    role: 'admin' as const,
    note: 'Pannello /admin, gestione utenti e punti',
  },
  {
    email: 'lettore@libery.test',
    password: DEMO_PASSWORD,
    displayName: 'Mario Lettore',
    role: 'user' as const,
    note: 'Utente normale: mappa, zaino, camera Prendo/Lascio',
  },
  {
    email: 'gab.verdini@gmail.com',
    password: 'G4br13l3$!',
    displayName: 'Gabriele',
    role: 'user' as const,
    note: 'Utente reale di test',
  },
  {
    email: 'biblio.gestore@libery.test',
    password: DEMO_PASSWORD,
    displayName: 'Gestore Biblioteca Demo',
    role: 'point_manager' as const,
    note: 'Gestore Biblioteca Alessandrina — approva consegne su /gestore',
  },
  {
    email: 'gestore.alessandrina@libery.test',
    password: DEMO_PASSWORD,
    displayName: 'Gestore Alessandrina',
    role: 'point_manager' as const,
    note: 'Responsabile Biblioteca Alessandrina (Roma)',
  },
  {
    email: 'gestore.torino@libery.test',
    password: DEMO_PASSWORD,
    displayName: 'Gestore Torino',
    role: 'point_manager' as const,
    note: 'Responsabile biblioteca Torino',
  },
  {
    email: 'gestore.bologna@libery.test',
    password: DEMO_PASSWORD,
    displayName: 'Gestore Bologna',
    role: 'point_manager' as const,
    note: 'Responsabile biblioteca Bologna',
  },
  {
    email: 'gestore.genova@libery.test',
    password: DEMO_PASSWORD,
    displayName: 'Gestore Genova',
    role: 'point_manager' as const,
    note: 'Responsabile biblioteca Genova',
  },
];

async function main() {
  console.log('\n=== Account Libery (test) ===\n');

  for (const acc of accounts) {
    const passwordHash = await hashPassword(acc.password);
    const user = await prisma.user.upsert({
      where: { email: acc.email },
      create: {
        email: acc.email,
        passwordHash,
        displayName: acc.displayName,
        role: acc.role,
        isActive: true,
      },
      update: {
        passwordHash,
        displayName: acc.displayName,
        role: acc.role,
        isActive: true,
      },
    });

    console.log(`${acc.role.toUpperCase().padEnd(14)} ${acc.email}`);
    console.log(`               password: ${acc.password}`);
    console.log(`               ${acc.note}`);
    console.log(`               id: ${user.id}\n`);
  }

  console.log('Gestore biblioteca (dopo seed:test-data + login su /gestore):');
  console.log('  biblio.gestore@libery.test / LiberyDemo2026!');
  console.log('\nQR punti seed (dopo seed:test-data):');
  console.log('  seed-bib-roma, seed-bib-torino, seed-bib-bologna, seed-bib-genova');
  console.log('\nCorner demo (dopo seed:demo-points):');
  console.log('  seed-corner-trastevere\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
