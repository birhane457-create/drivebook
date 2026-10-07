import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
config({ path: '.env' });
const prisma = new PrismaClient();

// Skip dedup step — test DB has no real production data with genuine duplicates
// (audit test slugs were cleaned up; any remaining nulls are already null)
console.log('Step 1: Skipped dedup (no production data in test DB)');

// Step 2: Add the unique index
await prisma.$executeRawUnsafe(
  'CREATE UNIQUE INDEX IF NOT EXISTS "Provider_customSlug_key" ON "Provider"("customSlug")'
);
console.log('Step 2: Unique index created on Provider.customSlug');

// Step 3: Verify the index exists
const idx = await prisma.$queryRawUnsafe(
  "SELECT indexname FROM pg_indexes WHERE tablename='Provider' AND indexname='Provider_customSlug_key'"
);
console.log('Step 3: Index verification:', JSON.stringify(idx));

await prisma.$disconnect();
console.log('Migration complete.');
