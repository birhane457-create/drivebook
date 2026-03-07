# Migration Scripts

## Available Scripts

### 1. backfill-verified-users.js
**Purpose**: Mark all existing users as email verified (grandfather clause)

**When to run**: Once after deploying email verification feature

**Usage**:
```bash
node backfill-verified-users.js
```

**Status**: ✅ Completed (0 users updated - all already verified)

---

### 2. backfill-guest-checkout-flag.js
**Purpose**: Set `isGuestCheckout = false` on all existing bookings

**When to run**: Once after deploying guest checkout tracking feature

**Usage**:
```bash
node backfill-guest-checkout-flag.js
```

**Status**: ✅ Completed (42 bookings updated)

---

## Notes

- These scripts are idempotent (safe to run multiple times)
- Both scripts have already been run successfully
- Keep these files for reference or future re-runs if needed
- Scripts automatically disconnect from database after completion
