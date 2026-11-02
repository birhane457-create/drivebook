# WLA-007 — Deployment Gap Evidence Record

**Date:** 2026-11-01  
**Environment:** drivebook_test, PostgreSQL 16.4, 127.0.0.1:5433  
**Investigator:** Kiro audit session  

---

## 1. Pre-application safety check (2026-11-01)

Query: `wla007-check-duplicates.sql`

**Result — existing Provider indexes (BEFORE):**
```
Provider_customSlug_key
Provider_pkey
Provider_state_suburb_idx
Provider_stripeCustomerId_key
Provider_userId_key
```
`Provider_customDomain_domainVerified_unique` was ABSENT.

**Result — duplicate verified domain check:**
```
customDomain | provider_count
(0 rows)
```
✅ No duplicates — safe to create index.

**Result — total verified domains:**
```
verified_count: 0
```
Zero verified domains in test DB.

---

## 2. Index application (test DB, 2026-11-01)

Applied via: `wla007-apply-index.sql`

```sql
CREATE UNIQUE INDEX IF NOT EXISTS "Provider_customDomain_domainVerified_unique"
ON "Provider" ("customDomain")
WHERE "domainVerified" = true;
```

**Result:** `CREATE INDEX` (exit 0)

**Post-application pg_indexes verification:**
```
schemaname | tablename | indexname                                    | indexdef
-----------+-----------+----------------------------------------------+------------------------------------------------------------------------
public     | Provider  | Provider_customDomain_domainVerified_unique  | CREATE UNIQUE INDEX "Provider_customDomain_domainVerified_unique" 
                                                                            ON public."Provider" USING btree ("customDomain") 
                                                                            WHERE ("domainVerified" = true)
```
✅ Index present and correctly conditional.

---

## 3. Deployment pipeline findings

| Platform | Build command | DB schema change? |
|---|---|---|
| Vercel | `prisma generate && next build` | No |
| Railway | `npm install && npx prisma generate` | No |

Neither `prisma db push` nor `prisma migrate deploy` is executed in either pipeline. The `prisma generate` step only regenerates the TypeScript client — it makes no database changes.

**Conclusion:** The repository-defined deployment commands (Vercel `vercel-build`, Railway `build`) do not apply the partial unique index. Whether other deployment mechanisms (Vercel project overrides, Railway service overrides, external scripts) apply it is not established by this investigation. The safe statement is: **these repository-committed build commands do not apply this index**. Production state must be confirmed independently.

---

## 4. Outstanding: production database

The production database has not been checked. The required queries are:

```sql
-- Check 1: duplicate verified domains (run FIRST; stop if any rows returned)
SELECT "customDomain", COUNT(*) AS provider_count
FROM "Provider"
WHERE "domainVerified" = true
  AND "customDomain" IS NOT NULL
GROUP BY "customDomain"
HAVING COUNT(*) > 1;

-- Check 2: index presence
SELECT schemaname, tablename, indexname, indexdef
FROM pg_indexes
WHERE tablename = 'Provider'
  AND indexname = 'Provider_customDomain_domainVerified_unique';
```

If Check 1 returns rows: **do not create the index**. Resolve duplicates first.  
If Check 1 returns 0 rows: apply `wla007-apply-index.sql`.  
Record execution timestamp, environment name, and pg_indexes output.

---

## 5. Important: migration history note

Manually applying SQL via psql does NOT create a record in `_prisma_migrations`. Record the deployment separately:
- Date/time of application
- Database environment identifier
- Operator or automated process
- pg_indexes output after application

Do not claim `_prisma_migrations` as proof of index presence unless `prisma migrate deploy` was actually used.

---

## 6. Required for WLA-007 FIX-VERIFIED

1. ✅ Test DB: partial unique index applied and confirmed (this session)
2. ⬜ Production DB: duplicate check → index application → pg_indexes confirmation
3. ⬜ Concurrency test: two providers verify same domain; one gets HTTP 409; only one verified owner remains
4. ⬜ Evidence preserved: pg_indexes output, deployment record, test execution log

WLA-007 remains **DEPLOYMENT GAP — OPEN** until steps 2–4 are complete.
