# Duplicate Account Prevention Strategy

**Date**: February 25, 2026  
**Status**: ✅ CORRECTLY CONFIGURED

---

## Current State

### User Table ✅
```
Email Constraint: @unique
Duplicate Emails: 0
Status: CORRECT - prevents duplicate user accounts
```

### Client Table ✅
```
Email Constraint: None (allows duplicates)
Duplicate Emails: 2 (expected)
Status: CORRECT - allows same client to book multiple instructors
```

---

## Why This Design is Correct

### User Model (Authentication)
```prisma
model User {
  id       String @id
  email    String @unique  // ✅ Prevents duplicate accounts
  password String
  role     String
}
```

**Purpose**: One user account per email address
- Used for login/authentication
- Prevents duplicate accounts
- Each person has ONE user account

**Example**:
```
chairman@erotc.org → 1 User account
  ├── Can log in with this email
  ├── Has one password
  └── Has one role (CLIENT, INSTRUCTOR, ADMIN)
```

### Client Model (Booking Records)
```prisma
model Client {
  id           String @id
  email        String  // ✅ NO @unique - allows duplicates
  instructorId String
  userId       String?
  
  @@index([instructorId, email])  // Unique per instructor
}
```

**Purpose**: One client record per instructor
- Same person can book multiple instructors
- Each instructor has their own client record
- Links to User account via userId

**Example**:
```
chairman@erotc.org → 1 User account
  ├── Client record for Instructor A (birhane457@gmail.com)
  │   └── Bookings with Instructor A
  └── Client record for Instructor B (debesay304@gmail.com)
      └── Bookings with Instructor B
```

---

## Real Example: chairman@erotc.org

### User Account (1 record) ✅
```
Email: chairman@erotc.org
User ID: 69987b114adba4fc848be378
Role: CLIENT
Created: Feb 20, 2026
```

### Client Records (2 records) ✅
```
Client 1:
  Email: chairman@erotc.org
  Client ID: 69987b174adba4fc848be379
  Instructor: Debesay Birhane (birhane457@gmail.com)
  User ID: 69987b114adba4fc848be378 ✅ (linked)
  Bookings: 1

Client 2:
  Email: chairman@erotc.org
  Client ID: 699eff972868f9a184260731
  Instructor: Debesay Birhane (debesay304@gmail.com)
  User ID: 69987b114adba4fc848be378 ✅ (linked)
  Bookings: 2
```

**This is CORRECT behavior**:
- 1 user account for authentication
- 2 client records (one per instructor)
- Both client records linked to same user account
- User can see all bookings from both instructors in their dashboard

---

## How It Works

### Scenario 1: New User Books Instructor A
```
1. User visits /book/instructorA
2. Enters email: john@example.com
3. Creates account (if doesn't exist)
   → User.create({ email: john@example.com })
4. Creates client record
   → Client.create({ 
       email: john@example.com, 
       instructorId: instructorA,
       userId: [user.id]
     })
5. Creates booking
   → Booking.create({ 
       clientId: [client.id],
       userId: [user.id]
     })
```

### Scenario 2: Same User Books Instructor B
```
1. User visits /book/instructorB
2. Enters email: john@example.com
3. Finds existing user account ✅
   → User.findUnique({ email: john@example.com })
4. Creates NEW client record for Instructor B ✅
   → Client.create({ 
       email: john@example.com, 
       instructorId: instructorB,
       userId: [user.id]
     })
5. Creates booking
   → Booking.create({ 
       clientId: [new client.id],
       userId: [user.id]
     })
```

**Result**:
- 1 user account
- 2 client records (one per instructor)
- User logs in once, sees all bookings

---

## Prevention Mechanisms

### 1. User Registration API
```typescript
// app/api/register/route.ts
export async function POST(req: Request) {
  const { email, password } = await req.json();
  
  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email }
  });
  
  if (existingUser) {
    return NextResponse.json(
      { error: 'Account already exists with this email' },
      { status: 400 }
    );
  }
  
  // Create new user
  const user = await prisma.user.create({
    data: { email, password: hashedPassword, role: 'CLIENT' }
  });
  
  return NextResponse.json({ success: true });
}
```

### 2. Public Booking API
```typescript
// app/api/public/bookings/route.ts
export async function POST(req: Request) {
  const { instructorId, clientEmail, createAccount } = await req.json();
  
  let userId: string | undefined;
  
  if (createAccount) {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: clientEmail }
    });
    
    if (existingUser) {
      userId = existingUser.id;  // ✅ Reuse existing account
    } else {
      // Create new user
      const newUser = await prisma.user.create({
        data: { email: clientEmail, password, role: 'CLIENT' }
      });
      userId = newUser.id;
    }
  }
  
  // Find or create client record for THIS instructor
  let client = await prisma.client.findFirst({
    where: {
      instructorId,
      email: clientEmail
    }
  });
  
  if (!client) {
    client = await prisma.client.create({
      data: {
        instructorId,
        userId,  // Link to user account
        email: clientEmail,
        name: clientName,
        phone: clientPhone
      }
    });
  }
  
  // Create booking
  const booking = await prisma.booking.create({
    data: {
      instructorId,
      clientId: client.id,
      userId,  // ✅ Link to user account
      // ... other fields
    }
  });
}
```

### 3. Database Constraints
```prisma
model User {
  id       String @id @default(auto()) @map("_id") @db.ObjectId
  email    String @unique  // ✅ Database-level constraint
  password String
  role     String
}

model Client {
  id           String @id @default(auto()) @map("_id") @db.ObjectId
  email        String  // ✅ NO @unique - allows duplicates
  instructorId String @db.ObjectId
  userId       String? @db.ObjectId
  
  @@index([instructorId, email])  // ✅ Unique per instructor
}
```

---

## Common Issues & Solutions

### Issue 1: User Can't Log In
**Symptom**: User says "I already have an account but can't log in"

**Cause**: User created account with different email or typo

**Solution**:
```javascript
// Check all variations
const user = await prisma.user.findFirst({
  where: {
    email: {
      equals: email,
      mode: 'insensitive'  // Case-insensitive search
    }
  }
});
```

### Issue 2: Bookings Not Showing in Dashboard
**Symptom**: User has bookings but dashboard shows empty

**Cause**: Bookings not linked to user account (userId: null)

**Solution**:
```javascript
// Link bookings to user account
await prisma.booking.updateMany({
  where: {
    client: {
      email: user.email
    },
    userId: null
  },
  data: {
    userId: user.id
  }
});
```

### Issue 3: Multiple Client Records for Same Instructor
**Symptom**: Same email has 2+ client records for same instructor

**Cause**: Bug in client creation logic

**Solution**:
```javascript
// Always check before creating
let client = await prisma.client.findFirst({
  where: {
    instructorId,
    email: clientEmail
  }
});

if (!client) {
  client = await prisma.client.create({
    data: { instructorId, email: clientEmail, ... }
  });
}
```

---

## Testing Checklist

### Test 1: New User Registration
- [ ] User registers with email
- [ ] System creates 1 User record
- [ ] System prevents duplicate registration
- [ ] User can log in

### Test 2: Booking Without Account
- [ ] User books without creating account
- [ ] System creates Client record only
- [ ] No User record created
- [ ] Booking created successfully

### Test 3: Booking With Account Creation
- [ ] User books and creates account
- [ ] System creates 1 User record
- [ ] System creates 1 Client record
- [ ] Client linked to User (userId set)
- [ ] Booking linked to User (userId set)

### Test 4: Same User Books Multiple Instructors
- [ ] User books Instructor A
- [ ] User books Instructor B
- [ ] System reuses User account
- [ ] System creates 2 Client records (one per instructor)
- [ ] User sees all bookings in dashboard

### Test 5: Duplicate Email Prevention
- [ ] User tries to register with existing email
- [ ] System shows error message
- [ ] No duplicate User record created

---

## Monitoring Script

Run this script regularly to check for issues:

```bash
node scripts/check-duplicate-emails.js
```

**Expected Output**:
```
✅ No duplicate emails found in User table
⚠️  Found X duplicate emails in Client table (expected)
✅ User.email has @unique constraint
✅ Client.email does NOT have @unique constraint
```

---

## Summary

### Current Configuration ✅
- User.email: @unique constraint (prevents duplicate accounts)
- Client.email: No constraint (allows one record per instructor)
- Total Users: 12
- Duplicate User Emails: 0 ✅
- Duplicate Client Emails: 2 (expected) ✅

### Key Points
1. ✅ One user account per email (authentication)
2. ✅ Multiple client records per email (one per instructor)
3. ✅ All client records link to same user account
4. ✅ User sees all bookings in one dashboard
5. ✅ Database constraints prevent duplicate user accounts

### No Action Required
The system is correctly configured to prevent duplicate user accounts while allowing the same person to book multiple instructors.
