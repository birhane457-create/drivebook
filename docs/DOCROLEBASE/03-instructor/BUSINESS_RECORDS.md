# Business Records

**Route:** `/dashboard/expenses`  
**Auth required:** INSTRUCTOR role  
**APIs:** `GET /api/instructor/expenses`, `POST /api/instructor/expenses`, `DELETE /api/instructor/expenses/[id]`  
**Nav:** Dashboard → More → Business Records  
**Last updated:** May 2026

---

## Purpose

A record-keeping tool for instructors to track their business income and expenses in one place. Designed for sole traders who need to keep records for their accountant or BAS agent.

**This tool does not:**
- Calculate tax liability
- Determine what is deductible
- Provide financial or tax advice
- Replace a registered tax agent

A prominent disclaimer is shown at the top of the page and in the CSV export.

---

## Income (read-only)

Income figures are fetched from DriveBook platform records via `GET /api/analytics`. They are read-only — instructors cannot edit them here.

| Field | Source |
|-------|--------|
| Gross lesson revenue | Sum of `Transaction.amount` for completed bookings |
| Platform commission | Sum of `Transaction.platformFee` |
| Net received | Sum of `Transaction.instructorPayout` |

Income from sources outside DriveBook (e.g. cash lessons not logged as offline bookings) is not included. Instructors are advised to record those separately.

---

## Expenses (self-entered)

Instructors log their own business expenses. DriveBook does not verify them.

### Categories

| Category key | Display label |
|-------------|---------------|
| `FUEL_VEHICLE` | Fuel & Vehicle |
| `INSURANCE` | Insurance |
| `TRAINING` | Training & Courses |
| `EQUIPMENT` | Equipment & Supplies |
| `SUBSCRIPTION` | Subscriptions |
| `OTHER` | Other |

### Fields per expense

| Field | Type | Notes |
|-------|------|-------|
| `date` | Date | YYYY-MM-DD |
| `category` | Enum | One of the 6 categories above |
| `description` | String | Max 200 chars |
| `amount` | Float | AUD, positive, max $100,000 |

---

## Period Filter

Instructors can filter by year (current year, last 2 years) and optionally by month. The income figures update to match the selected period.

---

## Summary Cards

Three cards shown at the top:

| Card | Label | Notes |
|------|-------|-------|
| Income | "Income (DriveBook)" | Net received after commission |
| Expenses | "Expenses (self-entered)" | Sum of all expense records in period |
| Difference | "Income minus expenses" | Arithmetic difference only — not labelled as profit or loss |

The difference card deliberately avoids "profit", "loss", or any tax-related language.

---

## CSV Export

The "Export CSV" button downloads a `.csv` file containing:

**Section 1 — Income:**
- Gross lesson revenue
- Platform commission (negative)
- Net received

**Section 2 — Expenses:**
- One row per expense record (date, category, description, amount as negative)
- Total expenses row

**Section 3 — Disclaimer:**
- Plain text disclaimer stating this is a record-keeping tool only
- Advises consulting a registered tax agent
- Notes that income is from DriveBook records and expenses are self-entered

The export is raw data — no calculations are labelled as tax, profit, or deductible amounts.

---

## Data Model

```prisma
model InstructorExpense {
  id           String     @id @default(cuid())
  instructor   Instructor @relation(fields: [instructorId], references: [id], onDelete: Cascade)
  instructorId String
  date         DateTime
  category     String
  description  String
  amount       Float
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt
}
```

Migration: applied via `prisma db push` (May 2026). Table exists in production.

---

## API Reference

### `GET /api/instructor/expenses`

Query params:
- `year` (required) — e.g. `2026`
- `month` (optional) — `1`–`12`

Returns: `{ expenses: InstructorExpense[] }`

### `POST /api/instructor/expenses`

Body:
```json
{
  "date": "2026-05-22",
  "category": "FUEL_VEHICLE",
  "description": "Fuel for lessons — week of 19 May",
  "amount": 85.50
}
```

Returns: `{ expense: InstructorExpense }` (201)

### `DELETE /api/instructor/expenses/[id]`

Ownership check: only the instructor who created the expense can delete it.

Returns: `{ success: true }` (200)

---

## Legal Boundary

The page is intentionally designed to stay within the boundary of a record-keeping tool:

- No tax estimates or calculations
- No "deductible" or "claimable" language
- No "profit" or "loss" labels
- Disclaimer shown on page load, in the summary, and in every CSV export
- Income data is read-only from platform records — cannot be manipulated
- ATO link provided for instructors who need tax guidance

---

## Related

- [EARNINGS.md](./EARNINGS.md) — Earnings breakdown (income only)
- [SETTINGS.md](./SETTINGS.md) — Payout settings and ABN
- `app/dashboard/expenses/page.tsx` — Page component
- `app/api/instructor/expenses/route.ts` — List + create
- `app/api/instructor/expenses/[id]/route.ts` — Delete
