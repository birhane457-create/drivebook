# Admin Quick Reference

**Last Updated:** July 2026  
**For:** Platform administrators — daily operations

---

## Daily Checks

| Task | Where | Frequency |
|------|-------|-----------|
| Pending instructor approvals | `/admin/instructors?status=PENDING` | Daily |
| Ended lessons needing completion | `/admin/bookings` (purple alert) | Daily |
| Open disputes | `/admin/disputes?status=open` | Daily |
| Expiring documents (30 days) | `/admin/documents` | Daily |
| Unverified ABNs | `/admin/instructors` filter | Weekly |

---

## Instructor Approval

1. Go to `/admin/instructors?status=PENDING`
2. Click instructor → review documents at `/admin/documents/review/[id]`
3. Check: license expiry, insurance expiry, police check, WWC check, vehicle registration
4. Click **Approve All Documents** → instructor becomes active on platform
5. If rejected: click X on the document → enter reason → instructor notified by email

---

## Payouts

**Process eligible payouts:** `/admin/payouts` → Eligible tab → "Pay" per instructor, or "Process All"

**Manual bank transfers (bank/manual payout method):**
1. Manual Transfers tab → Pending Transfer section
2. Transfer funds in your bank app
3. Click "Mark Sent" → enter bank transaction reference
4. Once instructor confirms: click "Confirm Received" → ledger updated

**Withheld / disputes:**
1. Withheld tab — no-show cases needing resolution
2. Click "Resolve this case" → choose action (refund client / approve payout / split / void)
3. All resolutions logged to audit log

---

## Bookings

**Mark lesson complete:** `/admin/bookings` → find booking → Manage → Mark as Completed  
**No-show:** Manage → Mark as No-Show → select who didn't show (instructor / client / both)  
**Cancel:** Manage → Cancel Booking (refund applied per cancellation policy)

The purple **Ended (unpaid)** banner appears when `CONFIRMED` bookings have passed their `endTime`. Process these daily so instructor payouts aren't held up.

---

## Support

**Find any user:** `/admin/support` → search by name or email → click user

**Actions available:**
- Send message (email + in-app notification)
- Reset password (sends 24h link)
- Add wallet credit (client accounts only)
- Deduct wallet credit (reason required)
- Approve / Suspend instructor (reason required for suspension)

---

## Revenue

**Reports:** `/admin/revenue` — date-filtered commissions, transactions, refunds  
**CSV exports:** `/admin/revenue` → Export button (bookings / revenue / instructors)  
**Ledger balance:** Revenue page → Platform Ledger section (real-time available balance)

---

## Pricing

**Change rates:** `/admin/pricing` — platform fee %, package discounts, commission rates  
**Schedule rate changes:** `/admin/pricing` → Rate Change Scheduler section  
Instructors are notified before effective date. Existing bookings are never retroactively affected.

---

## Settings

**Integration status:** `/admin/settings` — shows which env vars are configured  
**Notification channels:** `/admin/settings` → Notification Matrix (which events trigger email/SMS/in-app)  
**Booking window:** `/admin/settings` → Booking Rules (min advance hours, max advance days)

---

## Audit Log

Every financial action, approval, suspension, and dispute resolution is recorded at `/admin/audit-log`. Use it to answer "who did what and when".

---

## Emergency: Dispute / Chargeback

1. `/admin/disputes` → check open disputes
2. Click "View in Stripe ↗" to see dispute details and deadline
3. Gather evidence: booking detail, check-in records, instructor contact
4. Submit response in Stripe before deadline (usually 7 days)
5. If dispute won: click "Release payout hold" in the disputes page

---

## Key Routes

| Route | Purpose |
|-------|---------|
| `/admin` | Dashboard — stats, alerts, recent bookings |
| `/admin/instructors` | Manage all instructors |
| `/admin/documents` | Document compliance dashboard |
| `/admin/bookings` | All bookings — complete/no-show/cancel |
| `/admin/payouts` | Process payouts, resolve no-shows |
| `/admin/disputes` | Stripe chargeback management |
| `/admin/revenue` | Revenue reporting + CSV export |
| `/admin/pricing` | Commission rates and fees |
| `/admin/support` | User search + act on behalf |
| `/admin/audit-log` | Full audit history |
| `/admin/credits` | Client credit overview |
| `/admin/settings` | Platform settings + integration status |
| `/admin/voice-lines` | Twilio number pool management |
| `/admin/copilot` | AI admin query interface |
