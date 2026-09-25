# P1-03 Test Execution Evidence

**Finding:** C-2 — `getInstructorRisk` queried compliance fields from the wrong table
**Tool migrated:** `getInstructorRisk()` in `lib/admin/ai-tools.ts`
**Branch:** `audit/ai-enhancement-multimodel`
**Evidence date:** 2026-09-25

---

## The C-2 Finding

The original `getInstructorRisk` used `(prisma as any).provider.findMany` with
select fields (`insuranceExpiry`, `wwcCheckExpiry`) that do not exist on the
`Provider` model. Prisma silently returned `undefined` for each. The scoring loop
skipped every document check via `if (!c.date) continue`, producing a document
expiry risk contribution of exactly zero for every instructor, permanently.

The fields live in `DrivingProviderProfile` (moved there by migration
`20260814210950_remove_driving_fields_from_core_tables`).

---

## Remediation

**Query:** `prisma.drivingProviderProfile.findMany` — typed, no `(prisma as any)`

**Fields selected from `DrivingProviderProfile`:**
```typescript
select: {
  providerId: true,
  licenseExpiry: true,
  insuranceExpiry: true,
  wwcCheckExpiry: true,
  policeCheckExpiry: true,   // C-2 gap: was missing in earlier partial fix
}
```

All four regulatory compliance documents are now selected and scored.

**`InstructorRiskProvider.documents` shape:**
```typescript
documents: {
  profile:      'present' | 'missing' | 'unavailable'
  licence:      DocumentStatus
  insurance:    DocumentStatus
  wwcCheck:     DocumentStatus
  policeCheck:  DocumentStatus   // added for C-2 completeness
}
```

**Scoring per document:** expired → +15, expiring ≤14d → +12, expiring 15–30d → +8.

**Return type:** `Promise<ToolResult<InstructorRiskData>>` — fully typed contract.

**Error semantics:**
- Primary query fails → `ERROR`
- Profile/cancellation/dispute queries fail → `PARTIAL` with `missing[]`
- Provider has no `DrivingProviderProfile` row → `riskScore: null`, `riskLevel: 'unknown'`
  (correct: non-driving providers or providers with no profile are unknown, not clean)
- `null` expiry date → `DocumentStatus: 'unavailable'` → `riskScore: null`
  (correct: missing evidence is unknown, not a clean pass)

---

## Test Execution

### Command

```
npm test -- lib/admin/__tests__/instructor-risk.test.ts
```

### Output

```
 ✓ lib/admin/__tests__/instructor-risk.test.ts  (14 tests) 81ms

 Test Files  1 passed (1)
      Tests  14 passed (14)
   Duration  3.78s
```

### Full suite

```
npm test -- lib/admin/__tests__ __tests__/middleware
```

```
 ✓ lib/admin/__tests__/evidence-envelope.test.ts   (2 tests)
 ✓ lib/admin/__tests__/tool-contracts.test.ts      (24 tests)
 ✓ lib/admin/__tests__/remaining-tools.test.ts     (6 tests)
 ✓ lib/admin/__tests__/suburb-demand.test.ts       (3 tests)
 ✓ __tests__/middleware/s7-public-path-overlap.test.ts (40 tests)
 ✓ lib/admin/__tests__/get-health-score.test.ts    (12 tests)
 ✓ lib/admin/__tests__/daily-summary.test.ts       (3 tests)
 ✓ __tests__/middleware/s7-auth-flow.test.ts       (25 tests)
 ✓ lib/admin/__tests__/instructor-risk.test.ts     (14 tests)
 ✓ lib/admin/__tests__/weekly-report.test.ts       (3 tests)
 ✓ lib/admin/__tests__/p1-08-boundary.test.ts      (12 tests)

 Test Files  11 passed (11)
      Tests  144 passed (144)
   Duration  3.53s
```

---

## Acceptance Criteria — Status

| Criterion | Status |
|---|---|
| Baseline verified: query targeted wrong table | ✅ PASS — `(prisma as any)` with non-existent fields documented in C-2 |
| Production coverage measured | ✅ PASS — non-driving providers (no profile row) → `unknown`, not falsely `clean` |
| Query updated to `DrivingProviderProfile` | ✅ PASS — typed `prisma.drivingProviderProfile.findMany` |
| All four compliance documents selected | ✅ PASS — licence, insurance, wwcCheck, policeCheck |
| Returns `ToolResult<InstructorRiskData>` | ✅ PASS |
| PARTIAL if profile query fails | ✅ PASS — `missing: ['driving profiles']` |
| `null` expiry → `unavailable`, not false pass | ✅ PASS |
| Missing profile → `unknown`, not `low` risk | ✅ PASS |
| Tests cover profile completeness levels | ✅ PASS — 14/14 |
| policeCheckExpiry specifically tested | ✅ PASS — new test: "flags an expired policeCheckExpiry" |
| `(prisma as any)` removed | ✅ PASS — no casts in `getInstructorRisk` |
| Read-only boundary preserved | ✅ PASS — tool reads only, no mutations |

---

## Independent Verification Command

```
npm test -- lib/admin/__tests__/instructor-risk.test.ts
```

Expected: `Tests 14 passed (14)`, exit 0.
