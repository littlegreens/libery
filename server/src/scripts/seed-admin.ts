import 'dotenv/config';
import { prisma } from '../lib/prisma.js';
import { hashPassword } from '../lib/auth.js';

const email = (process.env.ADMIN_EMAIL ?? 'admin@libery.app').toLowerCase();
const password = process.env.ADMIN_PASSWORD ?? '123456789';
const displayName = process.env.ADMIN_DISPLAY_NAME ?? 'admin';

async function main() {
  const passwordHash = await hashPassword(password);
  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      passwordHash,
      displayName,
      role: 'admin',
      isActive: true,
    },
    update: {
      passwordHash,
      displayName,
      role: 'admin',
      isActive: true,
    },
  });

  console.log('Super admin pronto:');
  console.log(`  Email:    ${user.email}`);
  console.log(`  Password: ${password}`);
  console.log(`  ID:       ${user.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
