# MM-09 — Subscription Cancellation Authorization — REJECTED AS INVALID

**Finding ID:** MM-09  
**Original Classification:** LOW  
**Final Status:** REJECTED-AS-INVALID  
**Source Inspection Commit:** fcfc833f  
**Closure Date:** 2026-08-15

---

## Original Finding Statement

**Claim:** `subscription-cancel.ts` takes `stripeSubId` from caller with no internal ownership guard.

**Alleged Risk:** Attacker could supply arbitrary Stripe subscription ID to cancel another provider's subscription.

**Tracker Status (v5.1):**
- Finding: CONFIRMED
- Verification: VERIFIED
- Fix: NOT-STARTED
- Status: OPEN

---

## Source Inspection Results @ fcfc833f

### What the Code Actually Does

Inspected file: `lib/services/subscription-cancel.ts`

**Actual service interface:**
```typescript
interface CancelSubscriptionParams {
  providerId: string;      // NOT stripeSubId
  mode: 'period_end' | 'immediate';
  reason?: string;
  actorEmail: string;
}
```

**Actual service behavior:**

1. **Accepts `providerId`** from caller (NOT `stripeSubId`)
2. **Queries database** to find current subscription:
   ```typescript
   prisma.subscription.findFirst({
     where: {
       providerId,
       status: { in: ['TRIAL', 'ACTIVE', 'PAST_DUE'] },
     },
     orderBy: { createdAt: 'desc' },
   });
   ```
3. **Extracts Stripe ID internally** from DB record:
   ```typescript
   const stripeSubId = subscription.stripeSubscriptionId;
   ```
4. **Then calls Stripe** with internally-retrieved ID

**The original finding premise is false.** The service never accepts `stripeSubId` from the caller.

---

## Production Caller Authorization Analysis

### Caller 1: Instructor Web Route
**File:** `app/api/instructor/subscription/route.ts` (DELETE handler)

**Authorization:**
```typescript
const session = await getServerSession(authOptions);
const user = await prisma.user.findUnique({
  where: { email: session!.user!.email },
  include: { provider: true },
});

await cancelSubscription({
  providerId: user.provider.id,  // ✓ Own provider only
  ...
});
```

**Verdict:** ✅ SECURE — Uses authenticated user's own `provider.id`

---

### Caller 2: Instructor Mobile Route
**File:** `app/api/instructor/subscription/mobile/route.ts` (DELETE handler)

**Authorization:**
```typescript
const instructor = await getInstructorFromToken(req);  // JWT validation + DB lookup
if (!instructor) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

await cancelSubscription({
  providerId: instructor.id,  // ✓ JWT-authenticated instructor's own ID
  ...
});
```

**Verdict:** ✅ SECURE — JWT validated, DB lookup confirms identity, uses own `instructor.id`

---

### Caller 3: Admin Route
**File:** `app/api/admin/instructors/[id]/subscription/route.ts` (POST action=cancel/cancel_immediately)

**Authorization:**
```typescript
const session = await getServerSession(authOptions);
const deny = await requirePermission(session, PERM.USERS_PROVIDERS_MANAGE_SUBSCRIPTION);
if (deny) return deny;

await cancelSubscription({
  providerId: params.id,  // ⚠️ Route parameter (admin target)
  ...
});

await writeAuditLogSafe({
  action: 'SUBSCRIPTION_CANCELLED',
  actorId: session!.user.id!,
  actorRole: 'ADMIN',
  ...
});
```

**Verdict:** ✅ SECURE — This is **intentional authorized privilege escalation**:
- Requires `PERM.USERS_PROVIDERS_MANAGE_SUBSCRIPTION` permission
- Writes audit log with admin action traceability
- Designed to allow admins to cancel provider subscriptions
- Not a vulnerability; it's the admin's job

---

## Conclusion

### Original Attack Vector Assessment

**Claimed attack:** "Attacker supplies arbitrary `stripeSubId` to service"

**Reality:**
- Service does not accept `stripeSubId` parameter
- Service accepts `providerId`
- Service derives Stripe ID internally after DB lookup
- No production caller supplies Stripe IDs

**The described attack vector does not exist in the inspected production code paths.**

---

### Authorization Boundary Assessment

**Actual question:** "Can a caller supply arbitrary `providerId`?"

**Answer:**
- Instructor routes: NO — derive `providerId` from authenticated session/JWT
- Admin route: YES — but protected by `USERS_PROVIDERS_MANAGE_SUBSCRIPTION` permission check + audit logging

**No authorization gap exists.**

---

## Why This Finding Is Invalid

1. **Factual Premise Error:** The finding claims the service accepts `stripeSubId` from the caller. Source code shows it accepts `providerId` and derives the Stripe ID internally.

2. **Attack Vector Mismatch:** The threat model assumes direct Stripe ID manipulation, which is architecturally impossible given the actual service interface.

3. **Authorization Already Present:** All production callers establish appropriate authorization before supplying `providerId`.

4. **Stale Documentation:** The finding description matches a historical or hypothetical architecture, not the code at fcfc833f.

---

## Rejection Classification

**Status:** REJECTED-AS-INVALID

**Reason:** Original finding premise contradicted by source inspection. The service interface, data flow, and authorization boundaries do not match the finding description. No remediation required.

**Evidence Quality:** Source inspection conducted at commit fcfc833f with direct reading of:
- `lib/services/subscription-cancel.ts`
- `app/api/instructor/subscription/route.ts`
- `app/api/instructor/subscription/mobile/route.ts`
- `app/api/admin/instructors/[id]/subscription/route.ts`

---

## Audit Trail

| Date | Action | Commit |
|---|---|---|
| (Prior) | Finding marked CONFIRMED/VERIFIED in tracker v5.1 | fcfc833f |
| 2026-08-15 | Source inspection conducted | fcfc833f |
| 2026-08-15 | Finding rejected as invalid | (this commit) |

---

## Closure Checklist

- [x] Source inspection completed at known commit
- [x] Service interface documented (accepts `providerId`, not `stripeSubId`)
- [x] All three production callers analyzed
- [x] Authorization boundaries verified
- [x] Attack vector assessment: does not exist
- [x] Rejection reason documented
- [x] Evidence file created
- [ ] Tracker updated to REJECTED-AS-INVALID
- [ ] Tracker version incremented to 5.2

**Next Action:** Update AUDIT-MASTER-TRACKER.md with rejection status and evidence reference.
