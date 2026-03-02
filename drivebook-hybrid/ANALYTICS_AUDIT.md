# Analytics API Audit

## Current Implementation Review

### Data Being Collected ✅

Both analytics routes (`/api/analytics` and `/api/analytics/mobile`) collect:

1. **Total Bookings** - Count of all bookings in period
2. **Completed Bookings** - Count of COMPLETED status bookings
3. **Cancelled Bookings** - Calculated differently in each route
4. **Revenue** - Sum of prices from COMPLETED bookings
5. **New Clients** - Count of clients created in period
6. **Average Rating** - Placeholder (hardcoded)

---

## Issues Found ⚠️

### Issue 1: Cancelled Bookings Calculation Inconsistency

**Web Route** (`/api/analytics/route.ts`):
```typescript
cancelledBookings: totalBookings - completedBookings
```
❌ **Problem**: This includes PENDING, CONFIRMED, and other statuses as "cancelled"

**Mobile Route** (`/api/analytics/mobile/route.ts`):
```typescript
cancelledBookings: bookings.filter(b => b.status === 'CANCELLED').length
```
✅ **Correct**: Only counts actual CANCELLED bookings

**Impact**: Web dashboard shows inflated cancellation numbers

---

### Issue 2: Revenue Calculation Missing Commission

Both routes calculate:
```typescript
revenue: sum of booking.price
```

❌ **Problem**: This is GROSS revenue, not NET earnings after commission

**What's Missing**:
- Platform commission deduction
- Instructor's actual earnings
- Commission rate varies by subscription tier (12-15%)

**Example**:
- Booking price: $100
- Commission (12%): $12
- Instructor earnings: $88
- Currently shows: $100 ❌
- Should show: $88 ✅

---

### Issue 3: New Clients Count Incorrect

**Web Route**:
```typescript
clientCount: prisma.client.count({
  where: {
    instructorId: session.user.instructorId,
    createdAt: { gte: startDate }
  }
})
```
✅ **Correct**: Counts clients created in period

**Mobile Route**:
```typescript
const clientIds = new Set(bookings.map(b => b.clientId));
const newClients = clientIds.size;
```
❌ **Problem**: Counts UNIQUE clients with bookings, not NEW clients
- If existing client books again, they're counted
- If new client created but no booking, they're not counted

---

### Issue 4: Average Rating Hardcoded

Both routes:
```typescript
averageRating: 4.8 // or 5.0
```

❌ **Problem**: Not real data, just placeholder

**What's Needed**:
- Review/Rating table in database
- Calculate actual average from reviews
- Handle cases with no reviews

---

### Issue 5: Missing Important Metrics

Analytics don't include:
- **Earnings breakdown** (bookings vs packages)
- **Package sales** revenue
- **Pending bookings** count
- **Completion rate** percentage
- **Average booking value**
- **Peak booking times**
- **Client retention rate**
- **No-show rate**

---

## Recommended Fixes

### Fix 1: Correct Cancelled Bookings (Web Route)

```typescript
const [totalBookings, completedBookings, cancelledBookings, revenue, clientCount] = await Promise.all([
  prisma.booking.count({
    where: {
      instructorId: session.user.instructorId,
      startTime: { gte: startDate }
    }
  }),
  prisma.booking.count({
    where: {
      instructorId: session.user.instructorId,
      status: 'COMPLETED',
      startTime: { gte: startDate }
    }
  }),
  // FIX: Count actual cancelled bookings
  prisma.booking.count({
    where: {
      instructorId: session.user.instructorId,
      status: 'CANCELLED',
      startTime: { gte: startDate }
    }
  }),
  // ... rest
])
```

### Fix 2: Calculate Net Earnings with Commission

```typescript
// Get instructor's commission rate
const instructor = await prisma.instructor.findUnique({
  where: { id: session.user.instructorId },
  select: { commissionRate: true }
});

const commissionRate = instructor?.commissionRate || 15;

// Calculate gross revenue
const grossRevenue = await prisma.booking.aggregate({
  where: {
    instructorId: session.user.instructorId,
    status: 'COMPLETED',
    startTime: { gte: startDate }
  },
  _sum: { price: true }
});

const gross = grossRevenue._sum.price || 0;
const commission = gross * (commissionRate / 100);
const netEarnings = gross - commission;

return NextResponse.json({
  // ...
  grossRevenue: gross,
  commission: commission,
  netEarnings: netEarnings,
  commissionRate: commissionRate
});
```

### Fix 3: Include Package Earnings

```typescript
// Get package purchases in period
const packageEarnings = await prisma.transaction.aggregate({
  where: {
    instructorId: session.user.instructorId,
    type: 'PACKAGE_PURCHASE',
    status: 'COMPLETED',
    createdAt: { gte: startDate }
  },
  _sum: { amount: true }
});

const packageRevenue = packageEarnings._sum.amount || 0;
const totalRevenue = bookingRevenue + packageRevenue;
```

### Fix 4: Fix New Clients Count (Mobile)

```typescript
// Count clients created in period (not just clients with bookings)
const newClients = await prisma.client.count({
  where: {
    instructorId: decoded.instructorId,
    createdAt: {
      gte: startDate,
      lte: endDate
    }
  }
});
```

### Fix 5: Add Completion Rate

```typescript
const completionRate = totalBookings > 0 
  ? (completedBookings / totalBookings) * 100 
  : 0;

return NextResponse.json({
  // ...
  completionRate: Math.round(completionRate * 10) / 10 // Round to 1 decimal
});
```

---

## Data Accuracy Summary

| Metric | Web Route | Mobile Route | Accurate? |
|--------|-----------|--------------|-----------|
| Total Bookings | ✅ Correct | ✅ Correct | ✅ Yes |
| Completed Bookings | ✅ Correct | ✅ Correct | ✅ Yes |
| Cancelled Bookings | ❌ Wrong | ✅ Correct | ⚠️ Inconsistent |
| Revenue | ⚠️ Gross only | ⚠️ Gross only | ⚠️ Missing commission |
| New Clients | ✅ Correct | ❌ Wrong | ⚠️ Inconsistent |
| Average Rating | ❌ Hardcoded | ❌ Hardcoded | ❌ No |

---

## Priority Fixes

### High Priority 🔴
1. Fix cancelled bookings calculation (web route)
2. Add commission deduction to revenue
3. Fix new clients count (mobile route)

### Medium Priority 🟡
4. Add package earnings to revenue
5. Add completion rate metric
6. Add pending bookings count

### Low Priority 🟢
7. Implement real rating system
8. Add advanced metrics (retention, peak times, etc.)

---

## Testing Recommendations

After fixes, test with:
```bash
# Check analytics for current month
curl http://localhost:3000/api/analytics?period=month

# Expected response:
{
  "period": "month",
  "totalBookings": 10,
  "completedBookings": 8,
  "cancelledBookings": 1,  // Should be actual cancelled, not calculated
  "grossRevenue": 800,
  "commission": 96,        // 12% of 800
  "netEarnings": 704,      // 800 - 96
  "commissionRate": 12,
  "newClients": 3,
  "completionRate": 80.0
}
```

---

## Conclusion

The analytics collect basic data correctly, but have issues with:
- ❌ Cancelled bookings calculation (web)
- ❌ Revenue doesn't account for commission
- ❌ New clients count (mobile)
- ❌ Missing package earnings
- ❌ Hardcoded ratings

**Recommendation**: Apply the fixes above to ensure accurate financial reporting and analytics.
