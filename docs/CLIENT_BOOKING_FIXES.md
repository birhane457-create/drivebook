# Client Booking Flow - Critical Fixes

**Date:** February 26, 2026  
**Status:** Implementation Guide

---

## Overview

This document provides step-by-step fixes for the critical issues identified in the client booking flow and dashboard.

---

## Fix 1: Import Error in create-bulk API

### Issue
```
Attempted import error: 'buildAccountName' is not exported from '@/lib/services/ledger'
```

### Status
✅ **FIXED**

### Changes Made
- Updated import to use `buildAccount` instead of `buildAccountName`
- File: `app/api/client/bookings/create-bulk/route.ts`

---

## Fix 2: Separate Package from Booking

### Issue
Package purchases are incorrectly stored as booking records, causing confusion in the UI.

### Solution
Create a separate `Package` model and update the booking flow.

### Step 1: Update Prisma Schema

Add to `prisma/schema.prisma`:

```prisma
model Package {
  id                String   @id @default(cuid())
  userId            String
  instructorId      String
  clientId          String
  
  // Package details
  packageType       String   // PACKAGE_6, PACKAGE_10, PACKAGE_15, CUSTOM
  totalHours        Float
  usedHours         Float    @default(0)
  remainingHours    Float
  
  // Pricing
  purchasePrice     Float
  hourlyRate        Float
  discount          Float    @default(0)
  discountPercent   Float    @default(0)
  
  // Test package
  includesTestPackage Boolean @default(false)
  testPackagePrice    Float?
  
  // Status
  status            String   @default("active") // active, completed, expired, cancelled
  expiryDate        DateTime?
  
  // Payment
  isPaid            Boolean  @default(false)
  paidAt            DateTime?
  stripePaymentIntentId String?
  
  // Metadata
  notes             String?  @db.Text
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  // Relations
  user              User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  instructor        Instructor @relation(fields: [instructorId], references: [id], onDelete: Cascade)
  client            Client     @relation(fields: [clientId], references: [id], onDelete: Cascade)
  bookings          Booking[]  @relation("PackageBookings")
  
  @@index([userId])
  @@index([instructorId])
  @@index([clientId])
  @@index([status])
}

// Update Booking model
model Booking {
  // ... existing fields ...
  
  // Package relation
  packageId         String?
  package           Package?  @relation("PackageBookings", fields: [packageId], references: [id])
  
  // Remove these fields (moved to Package):
  // isPackageBooking
  // packageHours
  // packageHoursUsed
  // packageHoursRemaining
  // packageExpiryDate
  // packageStatus
  // parentBookingId
}
```

### Step 2: Create Migration Script

Create `scripts/migrate-packages.js`:

```javascript
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function migratePackages() {
  console.log('Starting package migration...');
  
  // Find all package bookings
  const packageBookings = await prisma.booking.findMany({
    where: {
      isPackageBooking: true,
      parentBookingId: null // Only parent packages
    },
    include: {
      client: true,
      instructor: true
    }
  });
  
  console.log(`Found ${packageBookings.length} package bookings to migrate`);
  
  for (const booking of packageBookings) {
    // Extract package details from notes
    const notes = booking.notes || '';
    const hoursMatch = notes.match(/BULK PACKAGE: (\d+) hours/);
    const hours = hoursMatch ? parseInt(hoursMatch[1]) : booking.packageHours || 0;
    const includesTestPackage = notes.includes('Test Package: Yes');
    
    // Determine package type
    let packageType = 'CUSTOM';
    if (hours === 6) packageType = 'PACKAGE_6';
    else if (hours === 10) packageType = 'PACKAGE_10';
    else if (hours === 15) packageType = 'PACKAGE_15';
    
    // Create package record
    const package = await prisma.package.create({
      data: {
        userId: booking.userId,
        instructorId: booking.instructorId,
        clientId: booking.clientId,
        packageType,
        totalHours: hours,
        usedHours: booking.packageHoursUsed || 0,
        remainingHours: booking.packageHoursRemaining || hours,
        purchasePrice: booking.price,
        hourlyRate: booking.instructor.hourlyRate,
        includesTestPackage,
        status: booking.packageStatus || 'active',
        expiryDate: booking.packageExpiryDate,
        isPaid: booking.isPaid,
        paidAt: booking.paidAt,
        stripePaymentIntentId: booking.stripePaymentIntentId,
        notes: booking.notes,
        createdAt: booking.createdAt
      }
    });
    
    // Find child bookings and link to package
    const childBookings = await prisma.booking.findMany({
      where: {
        parentBookingId: booking.id
      }
    });
    
    // Update child bookings to reference package
    for (const child of childBookings) {
      await prisma.booking.update({
        where: { id: child.id },
        data: { packageId: package.id }
      });
    }
    
    // Delete the old package booking record
    await prisma.booking.delete({
      where: { id: booking.id }
    });
    
    console.log(`✓ Migrated package ${booking.id} → ${package.id}`);
  }
  
  console.log('Package migration complete!');
}

migratePackages()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

### Step 3: Update Package Purchase API

Update `app/api/public/bookings/bulk/route.ts`:

```typescript
// Replace booking creation with package creation
const package = await prisma.package.create({
  data: {
    userId,
    instructorId: data.instructorId,
    clientId: client.id,
    packageType: data.packageType,
    totalHours: data.hours,
    usedHours: 0,
    remainingHours: data.hours,
    purchasePrice: data.pricing.total,
    hourlyRate: instructor.hourlyRate,
    discount: data.pricing.discount,
    discountPercent: data.pricing.discountPercentage,
    includesTestPackage: data.includeTestPackage,
    testPackagePrice: data.includeTestPackage ? data.pricing.testPackage : null,
    status: 'PENDING', // Will be activated after payment
    expiryDate: expiryDate,
    isPaid: false,
    notes: `Package: ${data.packageType}\nBooking Type: ${data.bookingType}\nRegistration Type: ${data.registrationType}\n${data.registrationType === 'someone-else' ? `Learner: ${data.learnerName}\nRelationship: ${data.learnerRelationship}\n` : ''}`,
  }
});

// Create individual booking records for scheduled lessons (if "Book Now")
if (data.bookingType === 'now' && data.scheduledBookings && data.scheduledBookings.length > 0) {
  for (const scheduledBooking of data.scheduledBookings) {
    // ... create booking with packageId: package.id
    await prisma.booking.create({
      data: {
        // ... existing fields ...
        packageId: package.id, // Link to package
        // Remove package-specific fields
      }
    });
  }
}

// Return package ID instead of booking ID
return NextResponse.json({
  success: true,
  packageId: package.id,
  clientId: client.id,
  total: data.pricing.total,
  commission
}, { status: 201 });
```

---

## Fix 3: Store Selected Instructor

### Issue
Selected instructor during registration is not stored, making it unavailable for "Book Later" flow.

### Solution
Add `preferredInstructorId` to Client model and store during registration.

### Step 1: Update Prisma Schema

```prisma
model Client {
  // ... existing fields ...
  
  preferredInstructorId String?
  preferredInstructor   Instructor? @relation("PreferredInstructor", fields: [preferredInstructorId], references: [id])
  
  @@index([preferredInstructorId])
}

model Instructor {
  // ... existing fields ...
  
  preferredByClients Client[] @relation("PreferredInstructor")
}
```

### Step 2: Update Registration API

In `app/api/public/bookings/bulk/route.ts`:

```typescript
// When creating or updating client
if (!client) {
  client = await prisma.client.create({
    data: {
      instructorId: data.instructorId,
      userId,
      name: clientName,
      email: clientEmail,
      phone: clientPhone,
      preferredInstructorId: data.instructorId // Store selected instructor
    }
  });
} else if (userId && !client.userId) {
  client = await prisma.client.update({
    where: { id: client.id },
    data: { 
      userId,
      preferredInstructorId: data.instructorId // Update preferred instructor
    }
  });
}
```

### Step 3: Update Current Instructor API

Update `app/api/client/current-instructor/route.ts`:

```typescript
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get client record
    const client = await prisma.client.findFirst({
      where: { userId: user.id },
      include: {
        preferredInstructor: {
          include: {
            user: { select: { email: true } },
            reviews: { select: { rating: true } }
          }
        }
      }
    });

    // Use preferred instructor if available, otherwise get from latest booking
    let instructor = client?.preferredInstructor;
    let packageInfo = null;
    
    if (!instructor) {
      // Fallback to latest booking instructor
      const latestBooking = await prisma.booking.findFirst({
        where: {
          userId: user.id,
          status: { in: ['CONFIRMED', 'COMPLETED', 'PENDING'] }
        },
        include: {
          instructor: {
            include: {
              user: { select: { email: true } },
              reviews: { select: { rating: true } }
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
      
      instructor = latestBooking?.instructor;
    }

    if (!instructor) {
      return NextResponse.json({ currentInstructor: null });
    }

    // Get active package for this instructor
    const activePackage = await prisma.package.findFirst({
      where: {
        userId: user.id,
        instructorId: instructor.id,
        status: 'active',
        remainingHours: { gt: 0 }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (activePackage) {
      packageInfo = {
        totalHours: activePackage.totalHours,
        usedHours: activePackage.usedHours,
        remainingHours: activePackage.remainingHours,
        expiryDate: activePackage.expiryDate,
        status: activePackage.status
      };
    }

    const avgRating = instructor.reviews.length > 0
      ? instructor.reviews.reduce((sum, r) => sum + r.rating, 0) / instructor.reviews.length
      : 0;

    // Get services offered
    const services = ['Regular Driving Lessons', 'PDA Test Package', 'Mock Test'];

    return NextResponse.json({
      currentInstructor: {
        id: instructor.id,
        name: instructor.name,
        profileImage: instructor.profileImage,
        phone: instructor.phone,
        email: instructor.user.email,
        baseAddress: instructor.baseAddress,
        hourlyRate: instructor.hourlyRate,
        averageRating: parseFloat(avgRating.toFixed(1)),
        totalReviews: instructor.reviews.length,
        offersTestPackage: true,
        services: services
      },
      packageInfo
    });
  } catch (error) {
    console.error('Error fetching current instructor:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

---

## Fix 4: Wallet Balance Calculation

### Issue
Wallet balance shows $0.00 after package purchase even though credits were added.

### Solution
Ensure wallet transaction is created correctly when package is purchased.

### Update Payment Webhook

In `app/api/payments/webhook/route.ts`:

```typescript
async function handlePaymentSuccess(paymentIntent: any) {
  const { id: paymentIntentId, metadata } = paymentIntent;
  const { packageId } = metadata; // Changed from bookingId

  if (!packageId) {
    console.error('No packageId in payment intent metadata');
    return;
  }

  // Update package as paid
  const package = await prisma.package.update({
    where: { id: packageId },
    data: {
      isPaid: true,
      paidAt: new Date(),
      status: 'active', // Activate package
      stripePaymentIntentId: paymentIntentId
    },
    include: {
      instructor: { include: { user: true } },
      client: true,
      user: true
    }
  });

  // Update or create wallet
  const wallet = await prisma.clientWallet.upsert({
    where: { userId: package.userId },
    create: {
      userId: package.userId,
      totalPaid: package.purchasePrice,
      creditsRemaining: package.purchasePrice,
      totalSpent: 0
    },
    update: {
      totalPaid: { increment: package.purchasePrice },
      creditsRemaining: { increment: package.purchasePrice }
    }
  });

  // Create wallet transaction
  await prisma.walletTransaction.create({
    data: {
      walletId: wallet.id,
      type: 'credit', // lowercase
      amount: package.purchasePrice, // positive for credit
      description: `Package purchase: ${package.totalHours} hours`,
      status: 'completed',
      metadata: {
        packageId: package.id,
        packageType: package.packageType,
        hours: package.totalHours
      }
    }
  });

  // Record in ledger
  await recordWalletAdd(prisma, {
    userId: package.userId,
    amount: package.purchasePrice,
    description: `Package purchase: ${package.totalHours} hours`,
    stripePaymentIntentId: paymentIntentId,
    createdBy: package.userId
  });

  // Send emails...
}
```

---

## Fix 5: Duplicate Email Prevention

### Issue
System may allow multiple accounts with the same email.

### Solution
Add proper email validation and password verification.

### Update Registration API

In `app/api/public/bookings/bulk/route.ts`:

```typescript
// Check for existing user
const existingUser = await prisma.user.findUnique({
  where: { email: data.accountHolderEmail }
});

if (existingUser) {
  // User exists - verify this is intentional
  // For now, return error to prevent duplicate accounts
  return NextResponse.json({ 
    error: 'An account with this email already exists. Please login instead.',
    code: 'EMAIL_EXISTS'
  }, { status: 409 });
}

// Create new user
const hashedPassword = await bcrypt.hash(data.accountHolderPassword, 10);
const newUser = await prisma.user.create({
  data: {
    email: data.accountHolderEmail,
    password: hashedPassword,
    role: 'CLIENT'
  }
});
userId = newUser.id;
```

---

## Fix 6: Display Package Options on Dashboard

### Create Package Display Component

Create `components/PackageOptions.tsx`:

```typescript
'use client';

import { useState, useEffect } from 'react';

interface PackageOption {
  type: string;
  hours: number;
  price: number;
  discount: number;
  description: string;
}

export default function PackageOptions({ instructorId }: { instructorId: string }) {
  const [packages, setPackages] = useState<PackageOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/instructors/${instructorId}/packages`)
      .then(res => res.json())
      .then(data => {
        setPackages(data.packages || []);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error loading packages:', err);
        setLoading(false);
      });
  }, [instructorId]);

  if (loading) {
    return <div>Loading packages...</div>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {packages.map((pkg) => (
        <div key={pkg.type} className="border rounded-lg p-4 hover:shadow-lg transition">
          <h3 className="text-lg font-bold">{pkg.hours} Hours</h3>
          <p className="text-sm text-gray-600">{pkg.description}</p>
          <div className="mt-4">
            <span className="text-2xl font-bold">${pkg.price}</span>
            {pkg.discount > 0 && (
              <span className="ml-2 text-sm text-green-600">
                Save {pkg.discount}%
              </span>
            )}
          </div>
          <button
            onClick={() => window.location.href = `/book/${instructorId}/package?type=${pkg.type}`}
            className="mt-4 w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700"
          >
            Purchase Package
          </button>
        </div>
      ))}
    </div>
  );
}
```

### Update Client Dashboard

In `app/client-dashboard/page.tsx`, add package options display:

```typescript
{currentInstructor?.currentInstructor && (
  <div className="mb-8">
    <h2 className="text-xl font-bold mb-4">Available Packages</h2>
    <PackageOptions instructorId={currentInstructor.currentInstructor.id} />
  </div>
)}
```

---

## Testing Checklist

After implementing these fixes, test:

- [ ] Package purchase creates Package record (not Booking)
- [ ] Wallet balance updates correctly after purchase
- [ ] Selected instructor is stored and displayed
- [ ] Duplicate email prevention works
- [ ] Package options display on dashboard
- [ ] "Book Later" flow shows selected instructor
- [ ] "Book Now" flow creates bookings linked to package
- [ ] Package hours decrement correctly when booking
- [ ] Transaction history shows correct amounts
- [ ] Emails are sent correctly

---

## Deployment Steps

1. **Backup database**
   ```bash
   pg_dump your_database > backup_$(date +%Y%m%d).sql
   ```

2. **Update schema**
   ```bash
   npx prisma migrate dev --name add_package_model
   ```

3. **Run migration script**
   ```bash
   node scripts/migrate-packages.js
   ```

4. **Deploy code changes**
   ```bash
   git add .
   git commit -m "Fix: Separate packages from bookings, store preferred instructor"
   git push
   ```

5. **Verify in staging**
   - Test all flows
   - Check wallet balances
   - Verify emails

6. **Deploy to production**
   - Run migrations
   - Monitor logs
   - Test critical paths

---

## Rollback Plan

If issues occur:

1. **Revert code**
   ```bash
   git revert HEAD
   git push
   ```

2. **Restore database**
   ```bash
   psql your_database < backup_YYYYMMDD.sql
   ```

3. **Investigate and fix**
   - Check logs
   - Identify root cause
   - Create hotfix

---

## Conclusion

These fixes address the critical issues preventing production deployment. The main changes are:

1. ✅ Fixed import error in create-bulk API
2. 📋 Separate Package model from Booking
3. 📋 Store preferred instructor
4. 📋 Fix wallet balance calculation
5. 📋 Add duplicate email prevention
6. 📋 Display package options on dashboard

**Status:** Import error fixed. Other fixes require schema changes and testing.

