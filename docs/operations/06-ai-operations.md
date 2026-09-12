# 06 — AI Operations

---

## AI Components

| Component | What it is | Who uses it |
|---|---|---|
| AI Receptionist (VAPI) | Voice AI that answers calls, books lessons, cancels, reschedules | Students calling instructor's dedicated line |
| Operations Copilot | Chat UI with live DB tools — revenue, risk, health | ADMIN / SUPER_ADMIN only (`/admin/copilot`) |

---

## AI Boundaries

### AI Receptionist MAY:
- Answer calls 24/7
- Search for instructors by location and transmission type
- Check available time slots
- Create bookings (calls `POST /api/public/bookings/bulk`)
- Send payment link via SMS
- Look up existing bookings by phone number
- Get cancellation policy and exact refund amounts
- Cancel bookings (OTP-verified)
- Reschedule bookings (OTP-verified)
- Check booking payment status and timeline
- Validate pickup addresses
- Check instructor service area

### AI Receptionist MAY NOT:
- Process or capture payments directly (sends Stripe-hosted URL via SMS)
- Approve short-notice bookings (instructor must approve)
- Access student account data beyond booking lookup
- Perform admin actions of any kind
- Make decisions based on its own judgment — the backend is the source of truth

### Operations Copilot MAY:
- Summarise platform performance
- Query revenue, booking counts, instructor risk
- Generate reports in plain English
- Search audit log data
- Recommend actions

### Operations Copilot MAY NOT:
- Approve refunds
- Approve instructors
- Process payouts
- Delete records
- Change pricing
- Suspend users
- Take any action — it is read-only, advisory only

> **Compliance note:** Every Copilot query is logged to `AuditLog` with `action: 'ADMIN_AI_QUERY'`, `actorId`, `toolsUsed`, and duration. This is mandatory — do not disable.

---

## AI Receptionist — Admin Operations

### Voice line status indicators (instructor dashboard):
| Status | Meaning |
|---|---|
| `ACTIVE` | Line is live, answering calls |
| `SUSPENDED` | Line suspended — contact support to reactivate |
| `NONE` | PRO+ instructor but line not yet assigned |

### When AI Receptionist is unavailable:
See [09 — Emergency Runbooks](./09-emergency-runbooks.md#twilio-outage)

### Updating the AI system prompt:
- File: `drivebook-hybrid/VAPI_SYSTEM_PROMPT.md`
- Support contact block at the top — update when support number or email changes
- Current year must be updated annually (`2026` → `2027`)
- After updating: re-upload prompt to VAPI dashboard
- Test with a real call before announcing changes

### What the AI reads verbatim vs derives:
| What AI reads | Source |
|---|---|
| Instructor name / school name | `displayName` field in recommendations API response |
| Package prices | `priceWithFee` from packages API — never calculates itself |
| Available slots | `voice.confirmation` from availability API |
| Refund amount | `refundAmount` from cancellation-policy API |
| Booking confirmation | `voice.confirmation` from bulk booking response |

**Critical:** AI never calculates prices, names, or refund amounts itself. If the API returns unexpected values, the AI reads them literally. Fix the backend, not the prompt.

---

## Copilot — Available Tools

| Tool | What it queries |
|---|---|
| `getDailySummary` | Yesterday's bookings, new students, week revenue, open issues |
| `getHealthScore` | Platform health 0–100 with signal breakdown |
| `getInstructorRisk` | At-risk instructors ranked by risk score |
| `getWeeklyReport` | This week vs last week revenue, bookings, completion rate |
| `getRevenueBreakdown` | Revenue, cancellation losses, top earners |
| `getStudentRetention` | Return rate, active students, repeat bookers |
| `getSuburbDemand` | Top suburbs by booking volume |
| `getOperationsTimeline` | Recent activity: booking status counts, payouts, disputes |

**Rate limit:** 20 queries per minute per admin. All queries are read-only — no mutations possible from Copilot.

---

## AI Governance Policy

The following require **human confirmation** before any action the AI recommends:
- Any financial action (refund, payout, wallet adjustment)
- Instructor approval or suspension
- Account changes of any kind
- Pricing or commission changes

AI recommendations are advisory. A human must initiate all consequential actions via the admin panel, not via the AI chat. This is non-negotiable for compliance.
