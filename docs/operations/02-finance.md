# 02 — Finance & Payments

---

## Payouts

**Automated run:** Every Tuesday 2am AWST (`cron/weekly-payouts`)

### Eligibility (system enforces automatically):
- `payoutMethod = 'stripe_connect'`
- `stripeAccountId` set, `chargesEnabled = true`, `payoutsEnabled = true`
- `payoutHold = false` (no open dispute)
- ABN verified (or no ABN — 47% withholding applies)
- Lesson ended > `lateCancellationWindowHours × 2` hours ago (default 48h)

### Before manual payout:
- [ ] Check automated run log first — avoid double-payment
- [ ] Confirm Stripe Connect onboarding complete
- [ ] Check `payoutHold` — **never override a payout hold without dispute resolution**
- [ ] Verify ABN status if payout > $0
- [ ] Check approval threshold (see §Approval Thresholds below)

### Approval thresholds:
| Amount | Who |
|---|---|
| ≤ $200 | ADMIN |
| $200–$1,000 | SUPERVISOR or ADMIN |
| > $1,000 | SUPER_ADMIN only |

### Do NOT:
- Trigger payout for instructor with `payoutHold = true`
- Process bank transfer payouts via Stripe route (manual only)
- Pay same instructor twice in one week without checking run log
- Modify `payoutsEnabled` / `chargesEnabled` directly — set by Stripe webhook

---

## Refunds

### Automatic tiers (DB-configured via `PlatformSettings.lateCancellationWindowHours`):
| Notice | Refund |
|---|---|
| ≥ 48h (fullRefundWindow) | 100% to wallet |
| 24–48h (lateWindow) | 50% to wallet |
| < 24h | 0% |
| PENDING_PAYMENT (unpaid) | 0% — slot released, no money moved |

### Manual override:
| Override amount | Who |
|---|---|
| ≤ $50 goodwill | ADMIN |
| ≤ $100 | ADMIN |
| $100–$500 | SUPERVISOR or SUPER_ADMIN |
| > $500 | SUPER_ADMIN only |

Monthly override cap: **$200 per staff per month**. Justification required (≥ 20 chars).

### Do NOT:
- Issue refund by directly modifying `ClientWallet.balance` — use the refund API
- Issue refund on already-refunded booking — check `refundedAt` first
- Override $0 refund (under 24h) without SUPER_ADMIN approval
- Refund while `payoutHold = true` — resolve dispute first

---

## Pricing Changes

### Commission rate changes:
- Prospective only — never retroactive
- Existing bookings keep rate locked at payment time
- Notify instructors 7 days before any increase
- **SUPER_ADMIN approval required**
- Document reason in audit log

### Platform fee changes:
- Affects student-facing prices immediately
- Test pricing calculator after change (`/admin/pricing` preview)
- **SUPER_ADMIN approval required**

### Cancellation window changes (`lateCancellationWindowHours`):
- Affects: cancel routes, cancellation-policy API, payout dispute buffer, CancelDialog UI
- Announce to instructors and students before changing
- The full-refund window is always `lateCancellationWindowHours × 2`

### Do NOT:
- Change `PlatformSettings` directly in DB — use `/admin/pricing` so change is logged
- Apply new rate to already-paid bookings

---

## Financial Reconciliation

### Daily (automated — `cron/reconcile-stripe`, 3am AWST):
- Check Stripe succeeded payments vs DB ledger entries
- Detect missing transfers for PAID payouts
- Flag stuck payouts (PROCESSING > 10 min)
- Auto-confirm clear-cut missed webhooks
- Backfill FinancialLedger gaps

**Admin action when reconciliation flags issues:**
- Review `/admin/reconciliation` report
- For `missingPayments`: verify booking status, check Stripe dashboard
- For `stuckPayouts`: check Stripe transfer status, resolve manually if needed
- For `missingTransfers`: verify with Stripe, do not double-pay

### Weekly (every Tuesday, automated):
- Payout run processes all eligible instructors
- Review payout summary for failures
- Notify incomplete-onboarding instructors (automated email)

### Monthly (manual — admin):
- [ ] Total platform revenue vs Stripe dashboard balance
- [ ] Total wallet credits issued vs wallet transactions
- [ ] Refund rate vs revenue (flag if > 10%)
- [ ] Failed payout count and reasons
- [ ] Open disputes count and amounts

### Annual:
- [ ] Full ledger audit
- [ ] ABN withholding summary for ATO
- [ ] GST reconciliation
- [ ] Audit log archival verification

---

## Wallet Adjustments

| Amount | Who |
|---|---|
| ≤ $50 | ADMIN |
| $50–$200 | SUPERVISOR |
| > $200 | SUPER_ADMIN |

**Do NOT** add wallet credit by editing `ClientWallet.balance` directly — always use the wallet transaction API.
