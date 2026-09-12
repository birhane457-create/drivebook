-- Migration: add LoginDevice and CardOrder tables
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard → your project → SQL Editor
-- This is safe to run — it uses IF NOT EXISTS so it won't error if already created.

-- ── LoginDevice ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "LoginDevice" (
    "id"          TEXT NOT NULL,
    "userId"      TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "lastUsedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress"   TEXT NOT NULL,
    "userAgent"   TEXT NOT NULL,
    "location"    TEXT,
    "trusted"     BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "LoginDevice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "LoginDevice_userId_fingerprint_key"
    ON "LoginDevice"("userId", "fingerprint");

CREATE INDEX IF NOT EXISTS "LoginDevice_userId_idx"
    ON "LoginDevice"("userId");

CREATE INDEX IF NOT EXISTS "LoginDevice_lastUsedAt_idx"
    ON "LoginDevice"("lastUsedAt");

ALTER TABLE "LoginDevice"
    DROP CONSTRAINT IF EXISTS "LoginDevice_userId_fkey";

ALTER TABLE "LoginDevice"
    ADD CONSTRAINT "LoginDevice_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;

-- ── CardOrder ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "CardOrder" (
    "id"           TEXT NOT NULL,
    "instructorId" TEXT NOT NULL,
    "quantity"     INTEGER NOT NULL,
    "suburbs"      TEXT,
    "notes"        TEXT,
    "status"       TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CardOrder_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CardOrder_instructorId_idx"
    ON "CardOrder"("instructorId");

CREATE INDEX IF NOT EXISTS "CardOrder_status_idx"
    ON "CardOrder"("status");

ALTER TABLE "CardOrder"
    DROP CONSTRAINT IF EXISTS "CardOrder_instructorId_fkey";

ALTER TABLE "CardOrder"
    ADD CONSTRAINT "CardOrder_instructorId_fkey"
    FOREIGN KEY ("instructorId") REFERENCES "Instructor"("id") ON DELETE CASCADE;

-- Done. Run: npx prisma generate to update the Prisma client types.
