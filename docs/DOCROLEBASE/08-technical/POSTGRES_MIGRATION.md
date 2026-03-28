# MongoDB → PostgreSQL Migration

**Status:** COMPLETE — PostgreSQL (Supabase) is now the active database  
**Completed:** March 2026  
**Database:** Supabase PostgreSQL — project `zzntmozvppyzeaqautpi`  
**Region:** ap-southeast-1 (Singapore)  

---

## What Was Done

### 1. `prisma/schema.prisma`
- `provider` changed from `"mongodb"` to `"postgresql"`
- All `@id @default(auto()) @map("_id") @db.ObjectId` → `@id @default(cuid())`
- All `@db.ObjectId` removed from every foreign key field
- All `@map("_id")` removed from `@id` fields
- `PayoutTransaction` model gained a proper `Transaction` relation (was missing in MongoDB version)

### 2. API code — MongoDB-only operators fixed
- `app/api/client/recommendations/route.ts` — replaced `isEmpty` and `hasSome` with JS-side filtering
- `app/api/staff/tasks/[id]/route.ts` — removed MongoDB ObjectId regex validation

### 3. Database connection
- `DATABASE_URL` updated to Supabase connection pooler URL (port 6543, `pgbouncer=true`)
- Direct connection (port 5432) does not work from serverless — must use pooler

### 4. Migration applied
```
npx prisma migrate dev --name init
```
Created `prisma/migrations/20260328041651_init/migration.sql` — all 19 tables created in Supabase.

---

## Connection String Format

```
postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
```

The `?pgbouncer=true&connection_limit=1` parameters are required for Prisma + Supabase serverless.

---

## Vercel Deployment

Update `DATABASE_URL` in Vercel → Settings → Environment Variables with the same pooler URL before deploying.

---

## Fresh Start

The PostgreSQL database is empty. All previous MongoDB test data is gone (expected — no real data existed).

To set up:
1. Go to `/admin/register` → create SUPER_ADMIN account
2. Login at `/login`
3. Configure platform settings at `/admin/settings`

---

## What Did NOT Change

- All API route logic — unchanged
- All page components — unchanged  
- All service files — unchanged
- All Prisma queries using standard operators — unchanged
- `mode: 'insensitive'` on string `contains` — works in PostgreSQL ✅
- `Json?` fields — work identically ✅
- `Int[]` arrays — work in PostgreSQL ✅

---

## What Changes

### 1. `prisma/schema.prisma` — Every model

**datasource block:**
```diff
- provider = "mongodb"
+ provider = "postgresql"
```

**Every `@id` field:**
```diff
- id String @id @default(auto()) @map("_id") @db.ObjectId
+ id String @id @default(cuid())
```

**Every `@db.ObjectId` on relation fields:**
```diff
- instructorId String @db.ObjectId
+ instructorId String
```
Remove `@db.ObjectId` from ALL foreign key fields. This affects every model.

**`@map("_id")` — remove from all `@id` fields** (MongoDB-only, not needed in Postgres)

**`Int[]` array fields on `Booking` and `LearningContent`:**

MongoDB supports native arrays. PostgreSQL does too — Prisma supports `Int[]` on PostgreSQL natively. No change needed here.

**`Json?` fields** — stay as `Json?`, works identically in PostgreSQL.

**`@unique` constraints** — stay as-is.

**`@default(auto())`** — changes to `@default(cuid())` or `@default(uuid())`.

---

### 2. API code — MongoDB-specific Prisma query operators

Two files use MongoDB-only operators that need replacing:

**`app/api/client/recommendations/route.ts`**

| MongoDB operator | PostgreSQL replacement |
|-----------------|----------------------|
| `lessonFeedback: { isEmpty: true }` | `lessonFeedback: { equals: [] }` or filter in JS |
| `pdaCodes: { hasSome: uniqueCodes }` | No direct equivalent — query all active content and filter in JS, OR use raw SQL |

**`app/api/client/instructors/mobile/route.ts`**

| MongoDB operator | PostgreSQL replacement |
|-----------------|----------------------|
| `name: { contains: specialty, mode: 'insensitive' }` | `name: { contains: specialty, mode: 'insensitive' }` — **this works in PostgreSQL too** ✅ |

**`app/api/staff/tasks/[id]/route.ts`**

Has a MongoDB ObjectId validation regex — remove or replace with cuid/uuid validation.

---

### 3. `prisma/migrations/` — New folder

PostgreSQL uses migration files. After switching:
```bash
npx prisma migrate dev --name init
```
This creates `prisma/migrations/` with the initial SQL. Commit this folder.

---

### 4. `.env` — New `DATABASE_URL`

```diff
- DATABASE_URL="mongodb+srv://..."
+ DATABASE_URL="postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres"
```

Supabase provides this URL from: Project Settings → Database → Connection string → URI

---

### 5. `package.json` — No changes needed

Prisma handles both databases. No new packages required.

---

## What Does NOT Change

- All API route logic — no changes
- All page components — no changes
- All service files (`payout-service.ts`, `ledger-service.ts`, etc.) — no changes
- All Prisma queries using standard operators (`findMany`, `create`, `update`, `$transaction`) — no changes
- `mode: 'insensitive'` on string `contains` — works in PostgreSQL ✅
- `Json?` fields — work identically ✅
- `Int[]` arrays — work in PostgreSQL ✅

---

## Step-by-Step Execution Plan

### Step 1 — Set up Supabase
1. Go to [supabase.com](https://supabase.com) → New project
2. Choose region: **ap-southeast-2 (Sydney)**
3. Set a strong database password
4. Copy the connection string from: Settings → Database → URI

### Step 2 — Update schema.prisma
- Change `provider` to `postgresql`
- Remove all `@db.ObjectId` annotations
- Remove all `@map("_id")` from `@id` fields
- Change `@default(auto())` to `@default(cuid())`

### Step 3 — Fix the two API files with MongoDB-only operators
- `recommendations/route.ts` — replace `isEmpty` and `hasSome`
- `staff/tasks/[id]/route.ts` — remove ObjectId regex validation

### Step 4 — Run migration
```bash
npx prisma migrate dev --name init
```

### Step 5 — Update `.env`
Replace `DATABASE_URL` with Supabase PostgreSQL URL

### Step 6 — Test locally
```bash
npm run dev
```
Verify: register, login, create booking, cancel booking, admin panel

### Step 7 — Update Vercel env vars
In Vercel dashboard: Settings → Environment Variables → update `DATABASE_URL`

### Step 8 — Deploy
Push to main → Vercel auto-deploys

---

## Risk Assessment

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| `hasSome` / `isEmpty` operators break | Certain | Fix in Step 3 before migrating |
| Missing `@db.ObjectId` removal causes build error | Certain | Systematic find-replace in schema |
| Existing test data lost | None — no real data | MongoDB backup already taken |
| Supabase free tier limits | Low | 500MB storage, 2 CPU — more than enough for launch |

---

## Supabase Free Tier Limits (relevant)

- 500 MB database storage
- 2 GB bandwidth/month
- Unlimited API requests
- Automatic daily backups (7 days)
- Sydney region available

More than sufficient for launch and early growth.
