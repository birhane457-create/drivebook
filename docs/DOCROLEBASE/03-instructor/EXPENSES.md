# Instructor Expense Tracking

**Purpose:** Track business expenses for instructors to enable financial reporting and tax planning.

**Status:** ⏳ AS IS (Partially Implemented) | ⏳ AS IT SHOULD BE (Design Spec)

---

## AS IS: Current Implementation

### Database Model

**Location:** `prisma/schema.prisma`

```prisma
model InstructorExpense {
  id           String     @id @default(cuid())
  instructor   Instructor @relation(fields: [instructorId], references: [id], onDelete: Cascade)
  instructorId String
  date         DateTime
  category     String     // FUEL_VEHICLE | INSURANCE | TRAINING | EQUIPMENT | SUBSCRIPTION | OTHER
  description  String
  amount       Float
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt
}
```

### Current Status

**Model Exists:** ✅ Yes — `InstructorExpense` defined in schema

**API Endpoints:** ❌ None (no routes for CRUD operations)

**UI Pages:** ❌ None (no instructor dashboard for recording expenses)

**Functionality:** ⚠️ Database structure ready, but no way to use it

### Schema Details

| Field | Type | Purpose |
|-------|------|---------|
| `id` | String (cuid) | Unique identifier |
| `instructorId` | String (FK) | Link to Instructor |
| `date` | DateTime | When the expense occurred |
| `category` | String | Expense type (FUEL_VEHICLE, INSURANCE, TRAINING, EQUIPMENT, SUBSCRIPTION, OTHER) |
| `description` | String | Details (e.g., "Fuel - Shell Bunbury $60") |
| `amount` | Float | Cost in AUD |
| `createdAt` | DateTime | When recorded (auto) |
| `updatedAt` | DateTime | Last modified |

### Relationship

**One Instructor → Many Expenses**

```typescript
// Instructor can have multiple expenses
const expenses = await prisma.instructor.findUnique({
  where: { id: "inst_123" },
  include: { expenses: true }
});

// Result:
// {
//   id: "inst_123",
//   name: "John Smith",
//   expenses: [
//     { id: "exp_1", date: "2026-06-01", category: "FUEL_VEHICLE", description: "Fuel", amount: 60 },
//     { id: "exp_2", date: "2026-06-05", category: "INSURANCE", description: "Monthly insurance", amount: 450 }
//   ]
// }
```

---

## AS IT SHOULD BE: Design Specification

### Use Cases

1. **Instructor Records Expense:** Monthly dashboard for logging fuel, insurance, equipment costs
2. **Financial Reporting:** Generate expense report for tax purposes (YTD summary)
3. **Net Income Calculation:** Earnings - Expenses = Net income (for planning)
4. **Tax Optimization:** Identify deductible categories for accountant
5. **Admin Analytics:** Aggregate expense data to understand instructor costs

### Proposed Features

#### 1. Expense Recording API

**Endpoint:** `POST /api/instructor/expenses`

**Request:**
```json
{
  "date": "2026-06-14",
  "category": "FUEL_VEHICLE",
  "description": "Fuel - BP Cannington",
  "amount": 75.50
}
```

**Response:**
```json
{
  "id": "exp_abc123",
  "instructorId": "inst_456",
  "date": "2026-06-14",
  "category": "FUEL_VEHICLE",
  "description": "Fuel - BP Cannington",
  "amount": 75.50,
  "createdAt": "2026-06-14T12:30:45.000Z"
}
```

**Validation:**
- Date must be within last 90 days (prevent retroactive data entry abuse)
- Amount > 0 and <= $5000 (reasonable limit per transaction)
- Category must be in enum (FUEL_VEHICLE, INSURANCE, TRAINING, EQUIPMENT, SUBSCRIPTION, OTHER)
- Description required (> 5 chars, <= 500 chars)

#### 2. Expense Listing API

**Endpoint:** `GET /api/instructor/expenses`

**Query Parameters:**
- `startDate`: ISO date (default: 90 days ago)
- `endDate`: ISO date (default: today)
- `category`: Filter by category (optional)
- `sort`: `date_asc` | `date_desc` | `amount_asc` | `amount_desc` (default: `date_desc`)
- `limit`: 10-100 (default: 50)
- `offset`: pagination

**Response:**
```json
{
  "expenses": [
    { "id": "exp_1", "date": "2026-06-14", "category": "FUEL_VEHICLE", "description": "Fuel", "amount": 75.50 },
    { "id": "exp_2", "date": "2026-06-12", "category": "INSURANCE", "description": "Insurance", "amount": 450.00 }
  ],
  "total": 2,
  "sumByCategory": {
    "FUEL_VEHICLE": 75.50,
    "INSURANCE": 450.00,
    "TRAINING": 0,
    "EQUIPMENT": 0,
    "SUBSCRIPTION": 0,
    "OTHER": 0
  },
  "totalExpenses": 525.50
}
```

#### 3. Expense Summary Report API

**Endpoint:** `GET /api/instructor/expenses/summary`

**Query Parameters:**
- `period`: `this_week` | `this_month` | `this_quarter` | `ytd` | `custom`
- `startDate` / `endDate`: Required if `period=custom`

**Response:**
```json
{
  "period": "2026-01-01 to 2026-06-14",
  "totalExpenses": 4250.75,
  "expensesByCategory": {
    "FUEL_VEHICLE": { "count": 24, "total": 1800 },
    "INSURANCE": { "count": 6, "total": 2700 },
    "TRAINING": { "count": 2, "total": 300 },
    "EQUIPMENT": { "count": 5, "total": 450 },
    "SUBSCRIPTION": { "count": 0, "total": 0 },
    "OTHER": { "count": 0, "total": 0 }
  },
  "averageExpensePerWeek": 651.65,
  "averageExpensePerDay": 93.09
}
```

#### 4. Update Expense API

**Endpoint:** `PATCH /api/instructor/expenses/{id}`

**Request:**
```json
{
  "description": "Fuel - Shell Cannington (updated)",
  "amount": 76.00
}
```

**Restrictions:**
- Can only edit expenses from current calendar year (tax year boundary)
- Can only edit within 30 days of creation
- Immutable fields: date, category (once set)

#### 5. Delete Expense API

**Endpoint:** `DELETE /api/instructor/expenses/{id}`

**Restrictions:**
- Can only delete within 30 days of creation
- Deletion soft-deleted (marked `deletedAt`, not truly removed for audit)
- Audit log entry created

#### 6. Dashboard Page

**URL:** `/dashboard/financials/expenses`

**Sections:**
1. **Quick Stats Card:**
   - Total expenses (YTD)
   - Average per week
   - Largest category

2. **Add Expense Form:**
   - Date picker (last 90 days only)
   - Category dropdown
   - Description text field
   - Amount input
   - Submit button

3. **Expense List:**
   - Filterable by category
   - Sortable by date/amount
   - Edit/delete buttons (with restrictions)
   - Search by description

4. **Expense Chart:**
   - Pie chart: expenses by category
   - Line chart: expenses over time (weekly/monthly)

5. **Export:**
   - CSV export (for tax prep)
   - PDF report

### Database Enhancements

#### Add Expense Receipt Tracking

```prisma
model InstructorExpense {
  ...
  receiptUrl          String?      // S3 URL to receipt image/PDF
  receiptUploadedAt   DateTime?
  receiptVerified     Boolean @default(false)
  receiptVerifiedBy   String?
  ...
}
```

#### Add Expense Categories Model

```prisma
model ExpenseCategory {
  id           String   @id @default(cuid())
  name         String   // "Fuel (Vehicle)", "Insurance", etc.
  code         String   @unique  // FUEL_VEHICLE, INSURANCE, etc.
  taxDeductible Boolean @default(true)
  description  String?
  createdAt    DateTime @default(now())
}
```

### Integration Points

#### 1. Payouts System
- Link expenses to payout period
- Show net payout = earnings - expenses (informational, not financial adjustment)
- Example: "This week you earned $480, with $75 in expenses, net $405"

#### 2. Financial Reporting
- Admin dashboard: aggregate all instructor expenses
- Identify cost drivers: which categories eat most of budget?
- Trends: fuel costs rising year-over-year?

#### 3. Tax Integration
- Export as CSV with category/description for accountant
- Compliance: store receipt for 7 years (ATO requirement)
- Categories align with ATO deductibility rules

#### 4. Mobile App
- Record expense on-the-go (photo of receipt)
- OCR receipt text → auto-populate amount
- Offline mode: queue for sync

### Rate Limiting

- Max 100 expenses per month (prevent spam)
- Max 5 expense uploads per hour (receipt images)

### Validation & Business Rules

1. **Amount Validation:**
   - Positive, <= $5000 per transaction
   - Realistic (system rejects $0.01 or $50,000 data entry errors)

2. **Date Validation:**
   - Must be within last 90 days (retroactive limit)
   - Cannot be in future (date validation on client + server)

3. **Category Validation:**
   - Must be in predefined enum
   - Cannot be changed after creation (audit trail)

4. **Edit/Delete Restrictions:**
   - Expenses > 30 days old: read-only
   - Past tax year: locked (immutable)
   - Only creator can edit (instructor only, not admin)

5. **Duplicate Prevention:**
   - Client-side: show recent expenses similar to new entry
   - Server-side: warn on duplicates (same date + category + amount)

### Security & Privacy

- Instructors see only their own expenses
- Admins can view all for analytics only
- Expense data NOT shared with stripe/payment systems
- Receipts encrypted in transit and at rest
- Audit log for all changes

---

## Implementation Roadmap

### Phase 1: Core API (1-2 weeks)
- [ ] POST /api/instructor/expenses (create)
- [ ] GET /api/instructor/expenses (list, filter, sort)
- [ ] GET /api/instructor/expenses/summary (report)
- [ ] PATCH /api/instructor/expenses/{id} (update)
- [ ] DELETE /api/instructor/expenses/{id} (soft delete)
- [ ] API tests (happy path + validation)

### Phase 2: Dashboard UI (1-2 weeks)
- [ ] Instructor expense page (`/dashboard/financials/expenses`)
- [ ] Expense form (date, category, description, amount)
- [ ] Expense list (sortable, filterable)
- [ ] Quick stats cards (total, avg/week, by category)
- [ ] Edit/delete buttons with restrictions

### Phase 3: Reports & Export (1 week)
- [ ] Summary report API
- [ ] CSV export endpoint
- [ ] PDF report generation
- [ ] Chart visualization (pie, line)

### Phase 4: Receipts (2 weeks)
- [ ] Receipt upload API
- [ ] Receipt storage (S3 signed URLs)
- [ ] Receipt OCR integration (optional, paid service)
- [ ] Admin verification workflow

### Phase 5: Mobile Integration (2 weeks)
- [ ] React Native mobile app page
- [ ] Camera integration for receipt capture
- [ ] Offline queue (Expo SQLite)

---

## Testing Plan

### Unit Tests
- Validation: negative amounts, invalid categories, future dates
- Date range filtering
- Category aggregation

### Integration Tests
- Create → Read flow
- Edit expiration (30-day window)
- Delete soft-delete + audit log
- Permission: only own expenses visible

### E2E Tests
- Full workflow: record expense → view in summary → export CSV
- Mobile: capture receipt → upload → view in dashboard

---

## References

- **Schema Model:** `prisma/schema.prisma` → `InstructorExpense`
- **Related:** Payout system, financial reporting, tax compliance
- **ATO Deductibility:** https://www.ato.gov.au/Business/Income-and-deductions/Deductions/

