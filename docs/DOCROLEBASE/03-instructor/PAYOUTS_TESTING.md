# Payout Card — Testing Guide

**Date:** June 2026  
**Feature:** Payout Schedule Card on Dashboard  
**Component:** `PayoutScheduleCard.tsx`  
**API:** `GET /api/instructor/payouts`

---

## Manual Testing Checklist

### 1. Dashboard Display

- [ ] Payout card appears in 4th stat card position
- [ ] Card layout matches other stat cards (dark theme, shadow, hover effect)
- [ ] Text is readable (font size, contrast)
- [ ] Icons display correctly (clock icon)
- [ ] Spacing and padding look good

### 2. Loading State

- [ ] Card shows skeleton/placeholder while loading
- [ ] Skeleton disappears when data loads
- [ ] Loading doesn't block page (other cards visible)

### 3. Data Display

- [ ] Next payout date displays (e.g., "Fri, 13 Jun")
- [ ] Days until payout displays ("in 2 days")
- [ ] Pending transfer amount shows (if any)
- [ ] Recent payouts list shows up to 3 items
- [ ] Payout reference numbers display (PAYOUT-XXX format)
- [ ] Payout amounts display with $ and .00
- [ ] Dates format correctly (en-AU locale)

### 4. Empty/Edge Cases

- [ ] If no payouts: shows "No payouts yet" or similar
- [ ] If no pending: pending section hidden (doesn't show $0)
- [ ] If only 1 recent payout: shows 1 item
- [ ] If 5+ recent payouts: shows 3 items + "View all" link

### 5. Links

- [ ] "View all payouts →" link navigates to `/dashboard/earnings`
- [ ] "Manage settings →" link navigates to `/dashboard/settings/payout`
- [ ] Both links open in same tab (no new tabs)

### 6. Error Handling

- [ ] If API fails: shows friendly error message
- [ ] Error card is red/amber (error styling)
- [ ] Error doesn't crash page (other cards still visible)
- [ ] Error message is helpful (not "undefined")

### 7. Mobile Responsiveness

**On mobile (< 480px):**
- [ ] Card stacks to full width
- [ ] Text is readable (not cramped)
- [ ] Tap targets are at least 44x44px
- [ ] No horizontal scrolling

**On tablet (480px - 768px):**
- [ ] Card displays properly in 2-column grid
- [ ] Text scales appropriately
- [ ] Touch-friendly spacing

**On desktop (> 768px):**
- [ ] Card displays in 4-column grid
- [ ] Alignment with other cards
- [ ] Hover effects work

### 8. Performance

- [ ] Dashboard loads in < 1s (with payout card)
- [ ] API response in < 200ms
- [ ] No console errors or warnings
- [ ] No layout shift after data loads
- [ ] Component doesn't cause memory leaks

### 9. Dates & Times

- [ ] Dates format correctly for Australian locale
- [ ] Date calculation for "days until" is correct
- [ ] Friday calculation works (next Friday logic)
- [ ] Handles different months/years correctly
- [ ] No timezone issues

### 10. API Validation

- [ ] API returns correct response structure
- [ ] All required fields present
- [ ] No null/undefined in unexpected places
- [ ] Currency values are numbers (not strings)
- [ ] Dates are ISO strings

---

## Test Data Scenarios

### Scenario 1: New Instructor (No Payouts)
- **Setup:** Fresh account, no payouts yet
- **Expected:** Next Friday estimate, no recent payouts, no pending
- **Test:** Verify card handles empty state gracefully

### Scenario 2: Recent Payout
- **Setup:** Payout completed this week
- **Expected:** Next Friday + 7 days, shows recent payout
- **Test:** Verify date calculation from last payout

### Scenario 3: Pending Payout
- **Setup:** Payout in PROCESSING status
- **Expected:** Shows pending amount, count of pending payouts
- **Test:** Verify pending section displays correctly

### Scenario 4: Multiple Pending Payouts
- **Setup:** 2-3 payouts in PROCESSING/PENDING_TRANSFER
- **Expected:** Sums total pending, shows count
- **Test:** Verify math is correct

### Scenario 5: Recent + Pending Combined
- **Setup:** 3 recent payouts + 2 pending
- **Expected:** Shows both sections
- **Test:** Verify both sections render

### Scenario 6: Long Payout Reference
- **Setup:** Payout with long reference number
- **Expected:** Text truncates or wraps appropriately
- **Test:** Verify no text overflow

---

## Browser Testing

- [ ] Chrome (desktop)
- [ ] Firefox (desktop)
- [ ] Safari (desktop)
- [ ] Safari (iOS)
- [ ] Chrome (Android)
- [ ] Edge (desktop)

---

## Accessibility Testing

- [ ] Component is keyboard navigable
- [ ] Links have proper focus states
- [ ] Color is not the only indicator (status uses symbols too)
- [ ] Font sizes are readable (not too small)
- [ ] Contrast ratios meet WCAG AA
- [ ] Error messages are clear (not just color)
- [ ] Icon has aria-label or is descriptive

---

## Integration Testing

- [ ] Works when logged in as INSTRUCTOR
- [ ] Shows 401 error if not authenticated (or redirects)
- [ ] Works with different subscription tiers
- [ ] Doesn't break other dashboard cards
- [ ] Works with different payout methods (Stripe, Bank)
- [ ] Handles timezone differences correctly

---

## API Testing

**Using curl or Postman:**

```bash
# Test with valid auth
GET /api/instructor/payouts
Authorization: Bearer <session_token>

# Expected: 200 with payout data

# Test without auth
GET /api/instructor/payouts

# Expected: 401 Unauthorized
```

---

## Performance Profiling

- [ ] Dashboard First Contentful Paint < 1s
- [ ] API response time < 200ms
- [ ] No unoptimized database queries (N+1)
- [ ] Component doesn't cause re-renders on scroll
- [ ] No memory leaks (test in DevTools)

---

## Error Scenarios to Test

1. **API Down:**
   - Expected: Friendly error message

2. **Invalid Session:**
   - Expected: 401 redirect to login

3. **Database Error:**
   - Expected: Generic error message (don't leak internals)

4. **Slow Network:**
   - Expected: Loading state visible, timeout after 30s

5. **Invalid Response:**
   - Expected: Graceful error handling

---

## Post-Deployment Monitoring

### Metrics to Watch:

- [ ] API error rate (target: < 1%)
- [ ] Dashboard load time (target: < 1s)
- [ ] API response time (target: < 200ms)
- [ ] JavaScript errors in console
- [ ] Support tickets mentioning payouts

### Success Indicators:

- [ ] Instructors see payout information
- [ ] No increase in support tickets
- [ ] No performance degradation
- [ ] Card renders correctly for all users

---

## Rollback Procedure

If critical issues found:

```bash
# Quick rollback (remove component):
# 1. Delete PayoutScheduleCard from dashboard/page.tsx import
# 2. Restore hourly rate card HTML
# 3. Deploy

# Full rollback:
# 1. Delete app/api/instructor/payouts/route.ts
# 2. Delete components/instructor/PayoutScheduleCard.tsx
# 3. Revert app/dashboard/page.tsx
# 4. Deploy
```

---

## Sign-Off

- [ ] Testing complete
- [ ] No critical issues found
- [ ] Ready for production

**Tested by:** _________________  
**Date:** _________________  
**Notes:** _________________

---

## Related Documentation

- [PAYOUTS.md](./PAYOUTS.md) — Full payout API documentation
- [DASHBOARD.md](./DASHBOARD.md) — Dashboard overview
- [SETTINGS.md](./SETTINGS.md) — Payout settings configuration
