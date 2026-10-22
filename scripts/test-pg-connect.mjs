// Test Prisma → PostgreSQL connectivity
import { PrismaClient } from '../node_modules/.prisma/client/index.js';

const p = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
  log: [],
});

try {
  const result = await p.$queryRaw`SELECT current_database() as db, version() as ver`;
  console.log('DB_OK');
  console.log('Database:', result[0].db);
  console.log('Version:', result[0].ver.slice(0, 60));
  await p.$disconnect();
  process.exit(0);
} catch (e) {
  console.log('DB_ERR:', e.message.slice(0, 200));
  await p.$disconnect().catch(() => {});
  process.exit(1);
}
