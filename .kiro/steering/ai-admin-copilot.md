# AI Admin Operations Copilot — Plan & Roadmap

## Goal
Give admins an intelligent daily brief and operations assistant built on top of DriveBook's existing data. No external ML training needed — query Prisma, interpret with LLM, surface in dashboard.

## Phases

### Phase 1 — Data Layer (DONE / in progress)
Pure data, no AI. Fast, no LLM cost, works offline.

**API endpoint:** `GET /api/admin/daily-summary`
Returns structured JSON:
- Yesterday's bookings: completed, cancelled, rescheduled, no-shows
- Revenue: collected, owed to instructors, platform cut
- New users: students, instructors registered
- Attention items: stuck payments (>24h PENDING), open disputes, instructors with Stripe incomplete, expiring documents, failed payouts
- Instructor highlights: top performer, new registrations needing approval
- Wallet anomalies: negative balances, large refunds

**Dashboard widget:** `AdminDailySummary` component on `/admin` page
- Shows yesterday summary cards
- Attention Required section with actionable items
- Each attention item links to the relevant admin page

### Phase 2 — AI Interpretation Layer
Pass the Phase 1 JSON to Claude/GPT-4o mini with a system prompt.
AI adds: "why it matters", trend context, plain-English recommendations.
Streamed into a "Daily Brief" section below the data widget.

**API endpoint:** `POST /api/admin/ai-brief` ✅ DONE
**Component:** `AdminAIBrief` ✅ DONE
- Generate on demand button
- OpenAI (gpt-4o-mini) with Anthropic (claude-3-haiku) fallback
- Graceful "setup required" state when no API key configured
- Cached in `AdminBrief` DB model (date-keyed)

### Phase 3 — Natural Language Queries (future)
Chat interface in admin dashboard. Tool-calling pattern only.

**Rules:**
- AI can ONLY call pre-defined read-only functions (whitelist)
- No raw SQL or Prisma query construction by AI
- Functions: getBookingsByPeriod, getRevenueByInstructor, getDisputesSummary, getInstructorIssues, getPaymentFailures
- Each function returns sanitised JSON — no PII beyond what admin already sees

**Example questions the AI can answer:**
- "Why is revenue down this week?"
- "Which instructors need attention?"
- "Summarise today's activity"
- "Show me payment failures this month"

### Phase 4 — Automated Reports (future)
- Daily email to admin at 8 AM with yesterday's brief
- Weekly executive summary (Monday 7 AM)
- Monthly board report (1st of month)
- Uses Phase 1 data + Phase 2 AI interpretation
- Sendgrid / Resend for delivery

## Architecture

```
Admin Dashboard
    ↓
AdminDailySummary component (client)
    ↓
GET /api/admin/daily-summary (server, auth-guarded)
    ↓
Prisma queries (read-only, date-bounded)
    ↓
Bookings | Transactions | Wallets | Disputes | Instructors | Audit logs
```

Phase 2 adds:
```
AdminDailySummary → POST /api/admin/ai-brief → LLM (Claude/GPT) → streamed summary
```

## Files Created / Modified

### Phase 1
- `app/api/admin/daily-summary/route.ts` — data endpoint
- `components/admin/AdminDailySummary.tsx` — dashboard widget
- `app/admin/page.tsx` — embed widget at top

### Phase 2
- `app/api/admin/ai-brief/route.ts` — AI interpretation endpoint
- `components/admin/AdminAIBrief.tsx` — streaming brief display
- `.env` — OPENAI_API_KEY or ANTHROPIC_API_KEY

### Phase 3
- `app/api/admin/ai-query/route.ts` — tool-calling chat endpoint
- `components/admin/AdminAIChat.tsx` — chat interface
- `lib/admin/ai-tools.ts` — whitelisted read-only query functions

## Security
- All endpoints require ADMIN or SUPER_ADMIN role (checked via getServerSession)
- AI query phase: tool whitelist enforced server-side, AI cannot construct arbitrary queries
- No PII sent to LLM beyond what admin already has access to
- LLM responses cached to avoid re-generation and reduce cost

## Environment Variables Needed (Phase 2+)
```
OPENAI_API_KEY=sk-...
# or
ANTHROPIC_API_KEY=sk-ant-...
```

---

## Priority 4 Roadmap (post Phase 1+2)

### P1 — AI Brief History ✅ DONE
Store every generated brief in DB. Schema already in place:
```prisma
model AdminBrief {
  id          String   @id @default(cuid())
  date        String   // YYYY-MM-DD  ← unique key
  summaryJson String   // raw summary data
  brief       String   // AI generated text
  model       String
  tokens      Int
  healthScore Int?     // platform health score at time of generation
  createdAt   DateTime @default(now())
  generatedBy String
}
```

**Changes:**
- `POST /api/admin/ai-brief` — now upserts to `AdminBrief` by date after generation. Returns cached brief if today's already exists (no LLM call). Pass `{ forceRegenerate: true, summary: {...} }` to overwrite.
- `GET /api/admin/ai-brief/history` — paginated history endpoint (default 14/page, max 30)
- `AdminAIBrief` component — shows "cached" badge when serving from DB, "Regenerate" forces fresh generation
- `AdminBriefHistory` component — timeline list with expandable brief text, health score badge per entry, 14-day health score sparkline, pagination. Shows on admin dashboard.

### P2 — Platform Health Score (0-100) ✅ DONE
Calculated from weighted signals:
- Booking completion rate (weight: 25)
- Failed payment rate (weight: 20)
- Open disputes (weight: 20)
- Instructor onboarding completion (weight: 15)
- Revenue trend WoW (weight: 10)
- Failed payout rate (weight: 10)

Score shown prominently at top of admin dashboard with colour coding:
- 90-100: green (healthy)
- 70-89: amber (watch)
- <70: red (attention needed)

API: `GET /api/admin/health-score` ✅ DONE
Component: `AdminHealthScore` ✅ DONE — ring gauge + compact signal summary + expandable breakdown

### P3 — Actionable Recommendations ✅ DONE
Attention items now include `estimatedImpact` and `action` on every item.

- Stuck payments → `"$340 in revenue awaiting collection"` → `"Chase students to top up wallets"`
- Stripe incomplete → `"~$1,240 in earnings blocked until onboarding complete"` → `"Contact instructors to complete Stripe Connect"`
- Open disputes → `"$680 at risk of chargeback loss"` → `"Submit evidence before Stripe deadlines"`
- Expiring docs → `"Expired documents will trigger automatic suspension"` → `"Notify instructors to upload renewed documents"`

API: `GET /api/admin/daily-summary` updated — blocked amounts calculated from real transaction data.
Component: `AdminDailySummary` updated — renders impact (amber) and action (→ instruction) under each item.

### P4 — Instructor Risk Monitor ✅ DONE
Internal score per instructor (0-100):
- Cancellation rate (30d)        max 20pts
- No-show rate (30d)             max 20pts
- Open disputes                  max 20pts
- Stripe onboarding incomplete   max 15pts
- Expiring documents (<30d)      max 15pts
- Low booking volume trend       max 5pts
- Low completion rate (30d)      max 5pts

Risk levels: Low (<30), Medium (30–59), High (60+)

API: `GET /api/admin/instructor-risk` ✅ DONE — batch queries, ?minScore & ?limit params
Component: `AdminInstructorRisk` ✅ DONE
- Full mode: filter tabs (all/high/medium/low), expandable per-instructor flag breakdown, stats grid
- Compact mode (compact prop): top 5 at-risk only, shown on admin dashboard
- Placed on /admin (compact) and /admin/instructors (full)

### P5 — Weekly Executive Report ✅ DONE
API: `GET /api/admin/weekly-report` — full aggregation: revenue WoW, bookings WoW, completion rate, new users, platform totals, top instructor, highest risk instructor, health score, all open issue counts.
API: `POST /api/admin/weekly-report` — sends dark-themed HTML email to `ADMIN_REPORT_EMAIL` env var (falls back to session email). Uses existing emailService transport.
Component: `AdminWeeklyReport` — dashboard widget with metrics grid, top/risk instructor highlights, open issues panel, "Email Report" button with inline send-result feedback.

### Operations Timeline ✅ DONE
API: `GET /api/admin/operations-timeline` — unified chronological event feed from AuditLog + Booking + Payout + StripeDispute. Query params: `hours` (1–168), `limit` (1–200), `types` (comma-separated: audit,booking,payout,dispute).
Component: `AdminOperationsTimeline` — events grouped by day, colour-coded severity icons (success/warning/error/info), source badges, time range selector (6h/24h/48h/7d), source filter tabs, auto-refresh button.
