# Staff Management System - Setup Guide

## Quick Start

The staff management system is now implemented! Follow these steps to get started.

### Step 1: Run Database Migration

First, you need to push the schema changes to your database:

```bash
npx prisma db push
```

This will add the new models:
- StaffMember
- InstructorAssignment
- Task
- TaskNote
- TaskTemplate

### Step 2: Create Staff Accounts

Run the setup script to create 3 staff members (one per department):

```bash
node scripts/setup-staff-system.js
```

This creates:
- **Financial Staff**: financial@staff.pda.com / Staff123!
- **Technical Staff**: technical@staff.pda.com / Staff123!
- **Support Staff**: support@staff.pda.com / Staff123!

⚠️ **IMPORTANT**: Change these passwords after first login!

### Step 3: Access the Staff Dashboard

1. Log in as admin at `/login`
2. Navigate to the admin dashboard
3. Click on "Staff Tasks" in the navigation
4. You'll see the staff dashboard at `/staff/dashboard`

### Step 4: Test the System

#### Create a Test Task

You can create tasks in two ways:

**Option 1: Via API**
```bash
curl -X POST http://localhost:3000/api/staff/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "type": "REFUND_REQUEST",
    "category": "FINANCIAL",
    "priority": "HIGH",
    "title": "Test Refund Request",
    "description": "Client requesting refund for cancelled booking",
    "contactName": "John Doe",
    "contactEmail": "john@example.com",
    "autoAssign": true
  }'
```

**Option 2: Programmatically**
```typescript
import { createRefundTask } from '@/lib/services/taskManager';

await createRefundTask({
  bookingId: 'booking-id',
  clientId: 'client-id',
  amount: 70,
  reason: 'Cancelled within 48 hours',
  contactName: 'John Doe',
  contactEmail: 'john@example.com'
});
```

## Features

### 1. Department-Based Task Routing

Tasks are automatically routed to the appropriate department:

- **FINANCIAL** → Financial staff
  - Refund requests
  - Payment disputes
  - Wallet issues
  - Payout requests

- **TECHNICAL** → Technical staff
  - Calendar sync errors
  - Booking system errors
  - App bugs
  - Integration issues

- **SUPPORT** → Support staff
  - Cancellation requests
  - Reschedule requests
  - General inquiries
  - Complaints

### 2. Auto-Assignment

When a task is created with `autoAssign: true`:
1. System finds staff member in the appropriate department
2. Selects staff with lowest current workload
3. Assigns task automatically
4. Updates staff's current load counter

### 3. Priority Levels

Tasks have 4 priority levels with automatic due dates:

- **URGENT** (🔴): Due in 1 hour
- **HIGH** (🟠): Due in 4 hours
- **NORMAL** (🟡): Due in 24 hours
- **LOW** (🟢): Due in 3 days

### 4. Task Workflow

```
OPEN → ASSIGNED → IN_PROGRESS → RESOLVED → CLOSED
                      ↓
                WAITING_RESPONSE
```

### 5. Internal Notes

Staff can add two types of notes:
- **Internal**: Only visible to staff (default)
- **Customer-facing**: Visible to customers (future feature)

## Integration Examples

### Auto-Create Task on Cancellation

Update your cancellation API to create a task:

```typescript
// In app/api/bookings/[id]/cancel/route.ts

import { createTask } from '@/lib/services/taskManager';

// After processing cancellation
if (refundAmount > 0) {
  await createTask({
    type: 'CANCELLATION_REQUEST',
    category: 'SUPPORT',
    priority: 'NORMAL',
    title: `Cancellation - Booking #${booking.id}`,
    description: `Booking cancelled. Refund of $${refundAmount} processed.`,
    bookingId: booking.id,
    clientId: booking.clientId,
    contactName: client.name,
    contactEmail: client.email,
    autoAssign: true
  });
}
```

### Auto-Create Task on Calendar Sync Error

```typescript
// In lib/services/googleCalendar.ts

import { createCalendarSyncTask } from '@/lib/services/taskManager';

try {
  // Calendar sync logic
} catch (error) {
  await createCalendarSyncTask({
    instructorId: instructor.id,
    instructorName: instructor.name,
    instructorEmail: instructor.user.email,
    error: error.message
  });
}
```

### Auto-Create Task on Payment Dispute

```typescript
// In app/api/payments/dispute/route.ts

import { createPaymentDisputeTask } from '@/lib/services/taskManager';

await createPaymentDisputeTask({
  clientId: client.id,
  bookingId: booking.id,
  amount: disputeAmount,
  reason: disputeReason,
  contactName: client.name,
  contactEmail: client.email,
  contactPhone: client.phone
});
```

## Staff Dashboard Features

### Dashboard View (`/staff/dashboard`)
- View all tasks
- Filter by status, priority, category
- Search tasks
- See task statistics
- Quick access to urgent tasks

### Task Detail View (`/staff/tasks/[id]`)
- Full task details
- Add notes and updates
- Change task status
- View related entities (booking, instructor, client)
- Contact information

## Admin Features

### View All Staff
- See all staff members
- View workload (current tasks / max capacity)
- Performance metrics
- Department assignments

### Manage Tasks
- Create tasks manually
- Reassign tasks
- View task history
- Monitor resolution times

## Performance Metrics

The system tracks:
- **Tasks Completed**: Total tasks resolved by each staff member
- **Avg Resolution Time**: Average hours to resolve tasks
- **Satisfaction Score**: Customer satisfaction ratings (future)
- **Current Load**: Number of active tasks

## Best Practices

### 1. Use Auto-Assignment
Always use `autoAssign: true` unless you have a specific staff member in mind.

### 2. Set Appropriate Priority
- Use URGENT sparingly (system errors, payment disputes)
- Use HIGH for time-sensitive issues (refunds, calendar sync)
- Use NORMAL for routine tasks (cancellations, inquiries)
- Use LOW for non-urgent items (feature requests)

### 3. Add Detailed Descriptions
Include all relevant information in the task description:
- What happened
- When it happened
- Who is affected
- What action is needed

### 4. Link Related Entities
Always include IDs when available:
- `bookingId` for booking-related tasks
- `instructorId` for instructor issues
- `clientId` for client issues

### 5. Add Notes Regularly
Staff should add notes to document:
- Actions taken
- Customer communications
- Resolution steps
- Follow-up needed

## Troubleshooting

### Tasks Not Auto-Assigning

Check if staff members exist and are active:
```bash
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.staffMember.findMany().then(staff => {
  console.log('Staff members:', staff);
  prisma.\$disconnect();
});
"
```

### Staff Load Not Updating

The system automatically increments/decrements load. If it's stuck:
```bash
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.staffMember.updateMany({
  data: { currentLoad: 0 }
}).then(() => {
  console.log('Reset all staff loads');
  prisma.\$disconnect();
});
"
```

## Next Steps

1. ✅ Database schema added
2. ✅ Staff accounts created
3. ✅ Dashboard built
4. ✅ Task management working
5. 🔄 Integrate with existing features (cancellations, refunds, etc.)
6. 🔄 Add email notifications for new tasks
7. 🔄 Add SMS notifications for urgent tasks
8. 🔄 Build customer-facing task status page
9. 🔄 Add performance analytics dashboard
10. 🔄 Implement SLA tracking

## Support

If you need help:
1. Check the logs in the browser console
2. Check the server logs
3. Review the API responses
4. Check the database directly with Prisma Studio: `npx prisma studio`

The staff management system is ready to use! Start by creating test tasks and exploring the dashboard.
