import '../loadEnv.js';
import { enrichBooksMissingCovers } from '../services/bookCatalog.js';

async function main() {
  let total = 0;
  for (let pass = 0; pass < 10; pass++) {
    const n = await enrichBooksMissingCovers(30);
    total += n;
    console.log(`Pass ${pass + 1}: ${n} copertine salvate in DB`);
    if (n === 0) break;
  }
  console.log(`Fatto. Copertine aggiornate: ${total}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
