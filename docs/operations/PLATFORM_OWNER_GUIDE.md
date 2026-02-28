# Platform Owner Management Guide

## Overview
As the platform owner of DriveBook, you manage multiple driving instructors, handle subscriptions, and oversee the entire platform. This guide covers all management tasks.

---

## User Roles

### 1. SUPER_ADMIN (You - Platform Owner)
- Full access to everything
- Manage all instructors
- View platform revenue
- Approve/reject/suspend instructors
- Access admin dashboard at `/admin`
- Can create other admins

### 2. ADMIN (Your Staff)
- Same as SUPER_ADMIN but cannot create other admins
- Manage instructors
- View analytics
- Handle support

### 3. INSTRUCTOR
- Manage their own bookings and clients
- Configure their schedule and pricing
- Access instructor dashboard at `/dashboard`
- Pay subscription fees to you

### 4. CLIENT
- Book lessons
- Manage their bookings
- Leave reviews

---

## Getting Started as Platform Owner

### Step 1: Create Your Admin Account
```bash
npm run create:admin
```
This creates your SUPER_ADMIN account. Use this to login at `/login`

### Step 2: Access Admin Dashboard
- Login at: `http://localhost:3000/login`
- Navigate to: `http://localhost:3000/admin`

### Step 3: Initial Setup
Run these commands to set up the platform:
```bash
# Approve any pending instructors
npm run approve:instructors

# Set default working hours for instructors
npm run setup:hours

# Set default lesson durations
npm run setup:durations
```

---

## Daily Management Tasks

### 1. Approve New Instructors

**Via Admin Dashboard (Recommended):**
1. Go to `/admin/instructors`
2. See list of pending instructors
3. Click "Approve" to activate them
4. Click "Reject" to deny their application
5. Add rejection reason if needed

**Via Command Line:**
```bash
npm run approve:instructors
```

### 2. Monitor Platform Revenue

**Via Admin Dashboard:**
1. Go to `/admin`
2. View dashboard showing:
   - Total instructors (active/pending)
   - Total bookings
   - Revenue breakdown (subscriptions + commissions)
   - Recent activity

**Via API:**
```bash
# Get revenue for current month
curl http://localhost:3000/api/admin/revenue
```

### 3. Manage Instructor Status

**Suspend an Instructor:**
- Go to `/admin/instructors`
- Click "Suspend" on any instructor
- They can't receive bookings while suspended
- Can reactivate later

**Reject an Application:**
- Go to `/admin/instructors`
- Click "Reject" on pending instructor
- Provide reason for rejection
- They won't appear on platform

### 4. View All Bookings

**Via Admin Dashboard:**
- Go to `/admin` (coming soon - needs implementation)
- View all bookings across all instructors
- Filter by status, date, instructor

**Via Database:**
```bash
npx prisma studio
```
Opens visual database browser at `http://localhost:5555`

---

## Managing Your Staff (Creating Admins)

### Create Admin Account for Staff Member

**Option 1: Via Script**
```bash
npm run create:admin
```
Follow prompts to create admin account

**Option 2: Convert Existing User**
```bash
npm run make:admin
```
Enter email of existing user to make them admin

**Option 3: Via Database**
```bash
npx prisma studio
```
1. Open User table
2. Find the user
3. Change `role` to `ADMIN`

### Admin vs Super Admin
- **SUPER_ADMIN**: Can create other admins (you)
- **ADMIN**: Cannot create admins (your staff)

Both have same access to:
- Instructor management
- Platform analytics
- Revenue reports
- Booking oversight

---

## Revenue Management

### Understanding Revenue Streams

**1. Subscription Fees (Monthly)**
- PRO: $29/month per instructor
- BUSINESS: $59/month per instructor

**2. Commission Fees (Per Booking)**
- PRO: 12% of booking price
- BUSINESS: 7% of booking price
- New Student Bonus: +8% on first booking with new client

### View Revenue Reports

**Current Month Revenue:**
```bash
curl http://localhost:3000/api/admin/revenue
```

**Custom Date Range:**
```bash
curl "http://localhost:3000/api/admin/revenue?startDate=2026-01-01&endDate=2026-01-31"
```

**Revenue Breakdown Shows:**
- Total bookings (first vs repeat)
- Commission revenue
- Subscription revenue
- Revenue by tier (PRO vs BUSINESS)
- Instructor payouts

### Example Revenue Calculation

**Instructor on PRO Tier:**
- Monthly subscription: $29
- 20 bookings @ $70 each = $1,400
- 5 first bookings: $70 × 20% = $70 commission
- 15 repeat bookings: $1,050 × 12% = $126 commission
- **Your revenue: $29 + $70 + $126 = $225**
- **Instructor keeps: $1,400 - $196 = $1,204**

---

## Instructor Management

### Instructor Lifecycle

```
1. REGISTRATION
   ↓
2. PENDING (waiting for approval)
   ↓
3. APPROVED (active on platform)
   ↓
4. SUSPENDED (temporarily disabled)
   or
   REJECTED (denied access)
```

### Approval Checklist

Before approving an instructor, verify:
- [ ] Valid driving instructor license
- [ ] Insurance documents uploaded
- [ ] Profile completed (photo, bio, car details)
- [ ] Service areas defined
- [ ] Working hours configured
- [ ] Pricing set

### Bulk Operations

**Approve All Pending:**
```bash
npm run approve:instructors
```

**Set Default Hours for All:**
```bash
npm run setup:hours
```

**Set Default Durations for All:**
```bash
npm run setup:durations
```

---

## Subscription Management

### View Instructor Subscriptions

**Via API:**
```bash
curl http://localhost:3000/api/admin/revenue
```

Shows:
- Active subscriptions
- Trial subscriptions
- Monthly subscription revenue

### Subscription Tiers

**PRO - $29/month**
- Unlimited clients
- Google Calendar sync
- Analytics dashboard
- Email notifications
- 12% commission per booking

**BUSINESS - $59/month**
- Everything in PRO
- Multiple instructors under one account
- Branded booking page
- Priority support
- Custom domain
- 7% commission per booking

### Trial Period
- New instructors get 14-day free trial
- Full access to all features
- Automatically converts to paid after trial

---

## Platform Configuration

### Update Pricing

Edit `lib/services/payment.ts`:
```typescript
getSubscriptionPricing(tier: 'PRO' | 'BUSINESS') {
  const pricing = {
    PRO: {
      monthlyPrice: 29.00,  // Change this
      commissionRate: 12.0,  // Change this
      // ...
    },
    BUSINESS: {
      monthlyPrice: 59.00,  // Change this
      commissionRate: 7.0,   // Change this
      // ...
    }
  }
}
```

### Update Platform Settings

Edit `prisma/schema.prisma` Platform model:
```prisma
model Platform {
  proMonthlyPrice      Float    @default(29.00)
  businessMonthlyPrice Float    @default(59.00)
  proCommissionRate    Float    @default(12.0)
  businessCommissionRate Float  @default(7.0)
  newStudentBonusRate  Float    @default(8.0)
  trialDays           Int      @default(14)
}
```

Then run:
```bash
npx prisma db push
```

---

## Monitoring & Analytics

### Key Metrics to Track

**Daily:**
- New instructor registrations
- Pending approvals
- Total bookings
- Revenue

**Weekly:**
- Active instructors
- Booking completion rate
- Average booking value
- Instructor churn

**Monthly:**
- Total revenue (subscriptions + commissions)
- Revenue per instructor
- Platform growth rate
- Customer acquisition cost

### Access Analytics

**Admin Dashboard:**
- Go to `/admin`
- View real-time metrics

**Database:**
```bash
npx prisma studio
```
- View all data visually
- Export reports
- Run custom queries

---

## Common Management Tasks

### 1. Instructor Not Showing on Platform
```bash
# Check their status
npm run test:availability

# Approve them
npm run approve:instructors

# Set up their schedule
npm run setup:hours
npm run setup:durations
```

### 2. Instructor Can't Receive Bookings
Check:
- [ ] Approved status
- [ ] Working hours configured
- [ ] Allowed durations set
- [ ] Service areas defined
- [ ] Not suspended

### 3. Reset Instructor Password
```bash
npm run reset:password
```
Enter their email to reset

### 4. View All Platform Data
```bash
npx prisma studio
```
Opens at `http://localhost:5555`

### 5. Backup Database
```bash
# MongoDB backup (if using MongoDB Atlas)
# Use MongoDB Atlas UI to create backup
# Or use mongodump command
```

---

## Staff Training

### For Your Admin Staff

**Give them access to:**
1. Admin dashboard: `/admin`
2. This guide
3. Admin credentials (ADMIN role, not SUPER_ADMIN)

**Train them on:**
- Approving instructors (check documents first)
- Handling support tickets
- Monitoring bookings
- Viewing revenue reports

**They should NOT:**
- Create other admins (only you can)
- Change platform pricing
- Access database directly
- Modify instructor subscriptions manually

---

## Security Best Practices

### 1. Admin Account Security
- Use strong passwords
- Don't share SUPER_ADMIN credentials
- Create separate ADMIN accounts for staff
- Regularly review admin access

### 2. Instructor Verification
- Always verify documents before approval
- Check license validity
- Verify insurance coverage
- Review profile completeness

### 3. Data Protection
- Regular database backups
- Secure environment variables
- HTTPS in production
- Monitor for suspicious activity

---

## Troubleshooting

### Platform Not Loading
```bash
# Check if server is running
npm run dev

# Check database connection
npx prisma studio
```

### Can't Login as Admin
```bash
# Reset admin password
npm run reset:password

# Or create new admin
npm run create:admin
```

### Instructors Not Appearing
```bash
# Check approval status
node scripts/check-instructors.js

# Approve all pending
npm run approve:instructors
```

### No Available Time Slots
```bash
# Check instructor configuration
npm run test:availability

# Set up working hours
npm run setup:hours

# Set up durations
npm run setup:durations
```

---

## Quick Reference Commands

```bash
# Admin Management
npm run create:admin          # Create new admin account
npm run make:admin           # Convert user to admin
npm run reset:password       # Reset any user password

# Instructor Management
npm run approve:instructors  # Approve all pending instructors
npm run setup:hours         # Set default working hours
npm run setup:durations     # Set default lesson durations
npm run test:availability   # Test instructor availability

# Database
npx prisma studio           # Visual database browser
npx prisma db push          # Update database schema
npx prisma generate         # Regenerate Prisma client

# Development
npm run dev                 # Start development server
npm run build              # Build for production
npm start                  # Start production server
```

---

## Support & Maintenance

### Regular Maintenance Tasks

**Daily:**
- Review new instructor applications
- Monitor booking activity
- Check for support requests

**Weekly:**
- Review revenue reports
- Check for suspended/inactive instructors
- Backup database

**Monthly:**
- Analyze platform growth
- Review pricing strategy
- Update documentation
- Plan new features

### Getting Help

**Technical Issues:**
- Check logs: `npm run dev` output
- Check database: `npx prisma studio`
- Review error messages

**Business Questions:**
- Review revenue reports: `/api/admin/revenue`
- Check instructor metrics: `/admin/instructors`
- Analyze booking patterns

---

## Future Enhancements

**Coming Soon:**
- Automated billing with Stripe
- Instructor payout scheduling
- Advanced analytics dashboard
- Support ticket system
- Email notifications for admins
- Bulk instructor operations
- Custom reporting tools

---

## Contact & Support

For platform issues or questions:
1. Check this guide first
2. Review PROJECT_DOCUMENTATION.md
3. Check database with `npx prisma studio`
4. Review error logs in terminal

---

**Last Updated:** February 2026
**Platform Version:** 2.1.0
