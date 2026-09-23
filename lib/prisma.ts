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
 * Strategy: check for SUPABASE_POOLER_URL env var first (explicit pooler).
 * If not set, fall back to the Prisma default (DATABASE_URL from env).
 * Set SUPABASE_POOLER_URL on Vercel to the pooler connection string.
 */
function getDataSourceUrl(): string | undefined {
  // Explicit pooler override — set this on Vercel to the Supabase pooler URL
  const poolerUrl = process.env.SUPABASE_POOLER_URL ?? '';
  if (poolerUrl) {
    return poolerUrl;
  }

  // Fallback: also try DIRECT_URL if it looks like a pooler endpoint
  const direct = process.env.DIRECT_URL ?? '';
  if (direct.includes('pooler.supabase.com')) {
    return direct;
  }

  // Let Prisma use DATABASE_URL from the environment as normal
  return undefined;
}

const datasourceUrl = getDataSourceUrl();

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient(datasourceUrl ? { datasources: { db: { url: datasourceUrl } } } : undefined)

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
