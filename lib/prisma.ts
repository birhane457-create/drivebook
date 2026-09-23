import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/**
 * PAY-H-04 / Vercel Supabase connectivity:
 * The Vercel serverless runtime cannot reach the Supabase direct connection
 * (db.*.supabase.co:5432). It requires the connection pooler endpoint
 * (*.pooler.supabase.com:5432).
 *
 * When DATABASE_URL points to the direct endpoint and DIRECT_URL points to
 * the pooler endpoint, prefer DIRECT_URL for the runtime connection.
 * This is a Prisma-for-Vercel pattern when the local .env naming is inverted.
 */
function getDataSourceUrl(): string | undefined {
  const db     = process.env.DATABASE_URL  ?? '';
  const direct = process.env.DIRECT_URL    ?? '';

  const dbIsDirect     = db.includes('supabase.co:5432') && !db.includes('pooler');
  const directIsPooler = direct.includes('pooler.supabase.com');

  // If DATABASE_URL is the direct connection but DIRECT_URL is the pooler,
  // prefer the pooler for serverless runtime.
  if (dbIsDirect && directIsPooler) {
    return direct;
  }

  // Otherwise let Prisma read DATABASE_URL from the environment as normal.
  return undefined;
}

const datasourceUrl = getDataSourceUrl();

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient(datasourceUrl ? { datasources: { db: { url: datasourceUrl } } } : undefined)

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
