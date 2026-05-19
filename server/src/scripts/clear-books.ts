import 'dotenv/config';
import { prisma } from '../lib/prisma.js';

async function main() {
  const before = await prisma.book.count();
  const pointBooksBefore = await prisma.pointBook.count();
  const transactionsBefore = await prisma.transaction.count();

  const deleted = await prisma.book.deleteMany();

  const pointBooksAfter = await prisma.pointBook.count();
  const transactionsAfter = await prisma.transaction.count();

  console.log(`Libri eliminati: ${deleted.count} (erano ${before})`);
  console.log(`Point books: ${pointBooksBefore} → ${pointBooksAfter}`);
  console.log(`Transazioni: ${transactionsBefore} → ${transactionsAfter}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
