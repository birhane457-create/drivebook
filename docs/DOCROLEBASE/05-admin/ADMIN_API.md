# Admin API Endpoints

**Purpose:** Comprehensive admin dashboard APIs for managing instructors, clients, bookings, disputes, payouts, and platform settings.

**Status:** ✅ AS IS (20+ endpoints implemented) | ⚠️ AS IT SHOULD BE (Documentation gaps)

---

## AS IS: Current Implementation

### Overview

**Authorization:** All endpoints require ADMIN or SUPER_ADMIN role

**Location:** `app/api/admin/`

**Total Routes:** 28+ endpoints across 18 resource groups

### API Endpoints by Resource

#### 1. Bookings (`/api/admin/bookings/*`)

**GET `/api/admin/bookings`**
- List all bookings with filters
- Query params: `status`, `search`, `from`, `to`
- Returns: bookings array + stats (total, confirmed, pending, completed, cancelled, noShow, endedConfirmed)
- Max 200 results

**PATCH `/api/admin/bookings`**
- Update booking status (CONFIRMED, COMPLETED, CANCELLED, NO_SHOW, PENDING)
- Body: `{ bookingId, status, noShowParty? }`
- Returns: updated booking

#### 2. Instructors (`/api/admin/instructors/*`)

**GET `/api/admin/instructors`**
- List all instructors with filters
- Query params: `search`, `status` (APPROVED, PENDING, REJECTED), `tier`
- Returns: instructors array

**GET `/api/admin/instructors/[id]`**
- Get instructor details
- Returns: instructor profile + subscription + document status

**PATCH `/api/admin/instructors/[id]`**
- Update instructor (approval status, suspension, profile fields)
- Restricted fields: role-based authorization

#### 3. Clients (`/api/admin/clients/*`)

**GET `/api/admin/clients`**
- List all clients
- Query params: `search`, `instructorId`
- Returns: clients array

**GET `/api/admin/clients/[id]`**
- Get client details + booking history

**PATCH `/api/admin/clients/[id]`**
- Update client profile

#### 4. Disputes (`/api/admin/disputes/`)**

**GET `/api/admin/disputes`**
- List disputes with status filter
- Query params: `status` (open, won, lost, all)
- Returns: disputes array + enriched booking/instructor data + openCount

**PATCH `/api/admin/disputes`**
- Release payout hold after dispute won
- Body: `{ stripeDisputeId, action: "release-hold" }`

#### 5. Payouts (`/api/admin/payouts/*`)

**GET `/api/admin/payouts`**
- List all payouts with status filter
- Query params: `status` (PENDING, CONFIRMED, FAILED), `instructorId`

**GET `/api/admin/payouts/preview-all`**
- Preview payout amounts for all eligible instructors

**POST `/api/admin/payouts/process`**
- Process single instructor payout
- Body: `{ instructorId }`

**POST `/api/admin/payouts/process-all`**
- Process all eligible instructor payouts (batch operation)

**POST `/api/admin/payouts/resolve`**
- Resolve failed payout (retry or manual adjustment)
- Body: `{ payoutId }`

**POST `/api/admin/payouts/resolve-split`**
- Handle split payouts (multiple destinations)

**GET `/api/admin/payouts/[payoutId]`**
- Get payout details

#### 6. Ledger (`/api/admin/ledger/`)**

**GET `/api/admin/ledger`**
- View platform financial ledger (double-entry)
- Query params: `limit` (1-200), `type` (optional filter)
- Returns: ledger record + ledger entries

#### 7. Rate Changes (`/api/admin/rate-changes/*`)

**GET `/api/admin/rate-changes`**
- List all scheduled rate changes (pending, applied, cancelled)

**POST `/api/admin/rate-changes`**
- Schedule new commission rate change
- Body: `{ field, newRate, effectiveDate, reason }`
- Validation: effectiveDate must be future, rate must differ from current

**PATCH `/api/admin/rate-changes/[id]`** *(if exists)*
- Update or cancel pending rate change

#### 8. Documents (`/api/admin/documents/*`)

**GET `/api/admin/documents`**
- List documents pending approval
- Query params: `status` (PENDING, APPROVED, REJECTED)

**GET `/api/admin/documents/review/[instructorId]`**
- Get instructor's documents for review

**PATCH `/api/admin/documents/[docId]`**
- Approve or reject document
- Body: `{ status: "APPROVED" | "REJECTED", reason? }`

#### 9. Staff Governance (`/api/admin/staff-governance/*`)

**GET `/api/admin/staff-governance/stats`**
- Get platform operational stats
- Returns: pending approvals, disputes, refunds (this week vs all-time), instructor risk scores

#### 10. Audit Log (`/api/admin/audit-log/`)**

**GET `/api/admin/audit-log`**
- List all audit log entries
- Query params: `action`, `actorId`, `targetType`, `from`, `to`

#### 11. Analytics Endpoints

**GET `/api/admin/daily-summary`**
- Daily platform metrics (bookings, revenue, payouts)

**GET `/api/admin/weekly-report`**
- Weekly summary (trend analysis)

**GET `/api/admin/operations-timeline`**
- Timeline of recent operations

**GET `/api/admin/instructor-risk`**
- Risk scores for instructors (disputes, cancellations, ratings)

**GET `/api/admin/health-score`**
- Platform health indicators

**GET `/api/admin/fortress-dashboard`**
- Comprehensive admin dashboard data

#### 12. Settings (`/api/admin/settings/`)

**GET `/api/admin/settings`**
- Get platform settings (commission rates, fees, etc.)

**PATCH `/api/admin/settings`**
- Update platform settings
- Fields: commission rates, fee percentages, etc.

#### 13. Test Centers (`/api/admin/test-centres/*`)

**GET `/api/admin/test-centres`**
- List PDA test centers

**POST `/api/admin/test-centres`**
- Create new test center

**PATCH `/api/admin/test-centres/[id]`**
- Update test center

#### 14. Learning Content (`/api/admin/learning-content/`)

**GET `/api/admin/learning-content`**
- List learning modules

**POST `/api/admin/learning-content`**
- Create new learning content

#### 15. Transactions (`/api/admin/transactions/*`)

**GET `/api/admin/transactions`**
- List all transactions (bookings, refunds, payouts)

**GET `/api/admin/transactions/[transactionId]`**
- Get transaction details

#### 16. Users (`/api/admin/users/*`)

**GET `/api/admin/users`**
- List all users (clients, instructors, staff)

**GET `/api/admin/users/[userId]`**
- Get user profile + linked entities

#### 17. Revenue (`/api/admin/revenue/`)

**GET `/api/admin/revenue`**
- Platform revenue metrics (total, by tier, by period)

#### 18. AI & Copilot

**POST `/api/admin/ai-brief`**
- Get AI-generated brief of platform state

**GET `/api/admin/ai-brief/history`**
- View previous AI briefs

**POST `/api/admin/ai-query`**
- Ask AI questions about platform data

**POST `/api/admin/daily-summary`** *(AI version)*
- Generate AI-powered daily summary

---

## API Response Format

### Success Response
```json
{
  "data": [...],
  "status": 200,
  "message": "Success"
}
```

### Error Response
```json
{
  "error": "Error message",
  "status": 400 | 401 | 403 | 404 | 500
}
```

### Common Query Parameters

| Param | Type | Default | Example |
|-------|------|---------|---------|
| `limit` | number | 50 | `limit=100` |
| `offset` | number | 0 | `offset=50` |
| `sort` | string | varies | `sort=-createdAt` |
| `search` | string | - | `search=john` |
| `from` | ISO date | - | `from=2026-01-01` |
| `to` | ISO date | - | `to=2026-12-31` |
| `status` | enum | varies | `status=CONFIRMED` |

---

## AS IT SHOULD BE: Recommendations & Improvements

### 1. OpenAPI/Swagger Documentation (High Priority)

**Issue:** No formal API documentation. Developers must read code to understand endpoints.

**Recommendation:**
- Generate OpenAPI spec (Swagger) for all admin endpoints
- Host at `/api/docs` (Swagger UI)
- Include request/response schemas, error codes, auth requirements
- Tools: `openapi-ts`, `swagger-ui-express`

### 2. Consistent Response Format (High Priority)

**Issue:** Response formats vary across endpoints. Some return raw array, some return `{ data, status }`.

**Recommendation:**
- Standardize all responses to:
  ```json
  {
    "success": true/false,
    "data": [...],
    "meta": { "total": 100, "offset": 0, "limit": 50 },
    "errors": [...]
  }
  ```

### 3. Pagination Standardization (Medium Priority)

**Issue:** Pagination params inconsistent (some use `limit`/`offset`, some don't support it).

**Recommendation:**
- All list endpoints support: `limit` (1-200), `offset` (default 0), `sort` (default -createdAt)
- Add cursor-based pagination option for large datasets

### 4. Batch Operations API (Medium Priority)

**Issue:** No way to bulk-update resources. Admins must call endpoint per item.

**Recommendation:**
- Add batch endpoints: `POST /api/admin/[resource]/batch`
- Example: `POST /api/admin/bookings/batch` with `{ ids: [...], updates: {...} }`
- Return success count + errors for failed items

### 5. Webhook Events for Admin Actions (Medium Priority)

**Issue:** External systems can't react to admin actions (approvals, rejections, payout processing).

**Recommendation:**
- Emit webhook events:
  - `instructor.approved`, `instructor.suspended`
  - `payout.processed`, `payout.failed`
  - `dispute.resolved`
- Admin configurable webhook endpoints

### 6. Admin Audit Trail Improvements (Medium Priority)

**Issue:** Audit log exists but not visible in admin dashboard.

**Recommendation:**
- Create `/admin/audit-log` dashboard
- Filter by: user, action, resource, date range
- Export audit trail as CSV

### 7. Rate Limiting for Admin APIs (Low Priority)

**Issue:** Admin endpoints not rate-limited (potential for abuse).

**Recommendation:**
- Implement rate limits per admin user
- Higher limits than public APIs (e.g., 500 req/min vs 100 req/min)
- Track admin actions for anomaly detection

### 8. Caching Strategy (Low Priority)

**Issue:** Repeated admin queries hit database directly (slow dashboards).

**Recommendation:**
- Cache frequently accessed data (settings, instructor list) with 5-minute TTL
- Invalidate cache on updates (PATCH/POST)
- Use Redis for distributed caching

### 9. Data Export Endpoints (Low Priority)

**Issue:** No way to export data for reporting/analysis.

**Recommendation:**
- Add export endpoints for: bookings, instructors, transactions, payouts
- Formats: CSV, JSON, PDF
- Example: `GET /api/admin/bookings/export?format=csv&from=2026-01-01&to=2026-06-30`

### 10. Admin Role-Based Permissions (Medium Priority)

**Issue:** All admins can do everything. No granular permissions.

**Recommendation:**
- Define admin roles:
  - FINANCIAL: can view/process payouts, access ledger, manage disputes
  - SUPPORT: can manage bookings, clients, instructors (approval only)
  - TECHNICAL: can manage settings, documents, test centers
  - SUPER_ADMIN: full access
- Check role on every endpoint

---

## Implementation Checklist

- [ ] Generate OpenAPI spec for all endpoints
- [ ] Host Swagger UI at `/api/docs`
- [ ] Standardize response format across all endpoints
- [ ] Add pagination to all list endpoints
- [ ] Implement batch operation endpoints
- [ ] Create admin audit log dashboard
- [ ] Add admin dashboard webhooks
- [ ] Set up admin rate limiting
- [ ] Implement Redis caching for settings/lists
- [ ] Add data export functionality (CSV, JSON)
- [ ] Define granular admin roles + permissions
- [ ] Document all endpoints with examples

---

## Testing

### Test 1: Authorization

**Verify:** Each endpoint returns 401 if no session, 403 if user is not ADMIN/SUPER_ADMIN

### Test 2: List Endpoints

**Verify:** Each list endpoint supports `limit`, `offset`, `sort` parameters correctly

### Test 3: Create/Update

**Verify:** Changes persist in database and audit log records action

### Test 4: Error Handling

**Verify:** Invalid inputs return 400 with descriptive error messages

---

## References

- **Location:** `app/api/admin/`
- **Auth:** `lib/auth.ts`
- **Database:** `prisma/schema.prisma`

