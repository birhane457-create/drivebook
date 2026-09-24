import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
const r = await p.$queryRaw`
  SELECT indexname, indexdef
  FROM pg_indexes
  WHERE tablename = 'AdminWalletIdempotencyKey'
`;
console.log(JSON.stringify(r, null, 2));
await p.$disconnect();
