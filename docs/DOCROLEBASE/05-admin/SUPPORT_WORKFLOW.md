# Support Workflow & Task Management System

## Overview
The Task Management system enables staff to track, assign, and resolve support issues across the platform. Tasks are auto-created for events (disputes, refunds, document expiry, booking errors) and auto-assigned to staff members based on workload and department.

**Status**: ✅ Implemented  
**Code**: `lib/services/taskManager.ts`, `Task` & `TaskNote` Prisma models  
**Features**: Auto-task creation, load-based assignment, priority-based due dates, SLA tracking  

---

## AS IS - Current Implementation

### Task Types

| Type | Category | Priority | Auto-Created | Use Case |
|------|----------|----------|--------------|----------|
| **REFUND_REQUEST** | FINANCIAL | HIGH | Manual (via API) | Client requests refund for completed booking |
| **PAYMENT_DISPUTE** | FINANCIAL | URGENT | Chargeback webhook | Stripe dispute opened (chargebackAutomation.ts) |
| **DOCUMENT_EXPIRY** | SUPPORT | HIGH/NORMAL | Cron job (future) | Instructor document expiring soon |
| **CALENDAR_SYNC_ERROR** | TECHNICAL | HIGH | Cron job | Google Calendar sync fails for instructor |
| **BOOKING_ISSUE** | TECHNICAL | URGENT | Error handler | Critical booking system error occurs |
| **COMPLAINT** | SUPPORT | HIGH | Manual | General complaint from client/instructor |

### Task Creation Flow

```typescript
// 1. Task is created via createTask() or specialized helpers
// 2. If autoAssign=true (default):
//    a. Query StaffMember table for available staff in category
//    b. Filter by: isActive=true, currentLoad < maxCapacity
//    c. Sort by currentLoad (ascending) - pick lowest
//    d. Assign to staff member
//    e. Increment staff.currentLoad by 1
// 3. Task status set to:
//    - 'ASSIGNED' if auto-assigned
//    - 'OPEN' if no staff available
```

### Task Fields (Prisma Model)

```prisma
model Task {
  id                    String
  type                  TaskType           // REFUND_REQUEST, PAYMENT_DISPUTE, etc.
  category              String             // FINANCIAL | TECHNICAL | SUPPORT
  priority              String             // URGENT | HIGH | NORMAL | LOW
  status                String             // OPEN | ASSIGNED | IN_PROGRESS | RESOLVED | CLOSED
  
  title                 String
  description           String
  
  // Linked entities
  instructorId          String?
  clientId              String?
  bookingId             String?
  userId                String?
  
  // Contact info (may differ from linked entity)
  contactName           String?
  contactEmail          String?
  contactPhone          String?
  
  // Assignment
  assignedToId          String?            // StaffMember.id
  assignedAt            DateTime?
  autoAssigned          Boolean            // true if auto-assigned
  
  // Financials (if applicable)
  financialAmount       Float?             // Refund amount, dispute amount, etc.
  
  // SLA tracking
  dueDate               DateTime           // Calculated from priority
  firstResponseAt       DateTime?
  resolvedAt            DateTime?
  slaBreached           Boolean            // Calculated by cron job
  
  // Escalation
  escalatedAt           DateTime?
  escalationCount       Int                // How many times escalated
  
  // Approval
  approvedByStaffId     String?
  approvalNotes         String?
  
  // Linked verification
  linkedEntityVerified  Boolean            // For governance
  
  // Metadata
  notes                 String?
  metadata              Json?              // Custom data
  
  createdAt             DateTime
  updatedAt             DateTime
  
  // Relations
  assignedTo            StaffMember?
  taskNotes             TaskNote[]
}

model TaskNote {
  id                    String
  taskId                String
  staffMemberId         String?
  note                  String
  createdAt             DateTime
}
```

### Auto-Creation Triggers

**1. Payment Dispute** (chargebackAutomation.ts)
```typescript
// When Stripe dispute webhook received (dispute.opened)
await createPaymentDisputeTask({
  clientId: dispute.client_id,
  bookingId: dispute.booking_id,
  amount: dispute.amount,
  reason: 'Stripe dispute',
  contactName: clientName,
  contactEmail: clientEmail,
})
// Priority: URGENT (due in 1 hour)
// Auto-assigned to FINANCIAL category staff
```

**2. Refund Request** (Manual via API)
```typescript
// When client/staff requests refund
await createRefundTask({
  bookingId,
  clientId,
  amount: refundAmount,
  reason: 'Client requested',
  contactName,
  contactEmail,
})
// Priority: HIGH (due in 4 hours)
// Auto-assigned to FINANCIAL staff
```

**3. Calendar Sync Error** (Cron job - future)
```typescript
await createCalendarSyncTask({
  instructorId,
  instructorName,
  instructorEmail,
  error: 'Google API returned 401',
})
// Priority: HIGH (due in 4 hours)
// Auto-assigned to TECHNICAL staff
```

**4. Document Expiry** (Cron job - future)
```typescript
await createDocumentExpiryTask({
  instructorId,
  instructorName,
  instructorEmail,
  documentType: 'Police Check',
  expiryDate: '2026-07-15',
})
// Priority: URGENT if < 7 days, HIGH if < 30 days
// Auto-assigned to SUPPORT staff
```

**5. Booking Error** (Error handler)
```typescript
await createBookingErrorTask({
  error: 'Database transaction failed',
  bookingId,
  instructorId,
  clientId,
})
// Priority: URGENT (due in 1 hour)
// Auto-assigned to TECHNICAL staff
```

### Staff Assignment Logic

```typescript
// Find available staff in category
const availableStaff = await prisma.staffMember.findFirst({
  where: {
    department: category,      // FINANCIAL | TECHNICAL | SUPPORT
    isActive: true,
    currentLoad: { lt: maxCapacity }
  },
  orderBy: { currentLoad: 'asc' }  // Pick lowest load
})

if (availableStaff) {
  task.assignedToId = availableStaff.id
  task.status = 'ASSIGNED'
  
  // Increment workload
  await prisma.staffMember.update({
    where: { id: availableStaff.id },
    data: { currentLoad: { increment: 1 } }
  })
}
```

**Rules**:
- Only assigns if staff.currentLoad < staff.maxCapacity
- Picks staff with lowest currentLoad (load balancing)
- If no capacity available: task stays OPEN, admin notified later
- Workload incremented on assignment, decremented on task closure

### Due Date Calculation (Priority-Based)

| Priority | Due In | Calculation |
|----------|--------|-------------|
| **URGENT** | 1 hour | `now + 1h` |
| **HIGH** | 4 hours | `now + 4h` |
| **NORMAL** | 24 hours | `now + 24h` |
| **LOW** | 3 days | `now + 3d` |

### Task Status Lifecycle

```
[OPEN]
  ├─→ ASSIGNED (auto-assigned to staff)
  │     ├─→ IN_PROGRESS (staff starts work)
  │     ├─→ RESOLVED (staff completes work)
  │     │     └─→ CLOSED (supervisor approves + closes)
  │     └─→ ESCALATED (if SLA breached or priority increases)
  │
  └─→ ESCALATED (if SLA breached while OPEN)
        └─→ ASSIGNED (re-assigned to supervisor)
```

### Implemented Features (✅)

- ✅ Task creation with auto-assignment
- ✅ Load-based staff assignment
- ✅ Priority-based due dates
- ✅ 7 task type helpers (dispute, refund, sync error, doc expiry, booking error, complaint)
- ✅ Workload tracking (increment on assign, decrement on close)

### Missing/Incomplete Features (❌)

- ❌ SLA breach detection (checkAndEscalateTasks exists but not called)
- ❌ Task escalation workflow (escalateTask exists but not integrated)
- ❌ Task closure governance (closeTaskWithGovernance exists but not called)
- ❌ Notification to staff (comments in code: "TODO: Send notification to supervisor")
- ❌ Task notes attachment UI
- ❌ Cron jobs for calendar sync errors, document expiry alerts
- ❌ Admin dashboard for task management

---

## AS IT SHOULD BE - Recommended Implementation

### 1. SLA Breach Detection & Escalation

**What's Missing**: Cron job to detect breached SLAs and auto-escalate

**Implementation**:
```typescript
// Create: app/api/cron/check-task-slas/route.ts
// Run: Hourly

export async function checkAndEscalateTasks() {
  const tasks = await prisma.task.findMany({
    where: {
      status: { in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS'] },
      slaBreached: false
    }
  })
  
  for (const task of tasks) {
    const slaCheck = calculateSLABreach(
      task.priority,
      task.createdAt,
      task.dueDate
    )
    
    if (slaCheck.breached) {
      // Mark as breached
      await prisma.task.update({
        where: { id: task.id },
        data: { slaBreached: true }
      })
      
      // Auto-escalate to supervisor
      await escalateTask({
        taskId: task.id,
        reason: `SLA breached by ${slaCheck.minutesOverdue} minutes`,
        autoEscalated: true
      })
      
      // Email supervisor
      await sendAlert({
        to: supervisor.email,
        subject: `URGENT: Task #${task.id} SLA Breached`,
        message: `${task.title} is overdue...`
      })
    }
  }
}
```

**Effort**: 3-4 hours

### 2. Cron Jobs for Auto-Task Creation

**What's Missing**: Scheduled tasks for calendar sync errors, document expiry alerts

**Implementation**:
```typescript
// app/api/cron/check-calendar-syncs/route.ts (daily)
// app/api/cron/check-document-expiry/route.ts (daily)
```

**Effort**: 2-3 hours each

### 3. Admin Dashboard for Task Management

**What's Missing**: UI to view, filter, update tasks

**Implementation**:
- Page: `/admin/tasks`
- Show: Task queue (filterable by status, priority, category)
- Actions: Assign, reassign, change priority, add notes, close

**Effort**: 4-5 hours

### 4. Notifications to Staff

**What's Missing**: Email/SMS when task assigned or SLA breached

**Implementation**:
- Email when task assigned (template: "New task assigned to you")
- Email when SLA breached (template: "URGENT: Task overdue")
- SMS for URGENT tasks (optional)

**Effort**: 2-3 hours

### 5. Task Notes & Communication

**What's Missing**: UI for staff to add notes to tasks

**Implementation**:
- Endpoint: `POST /api/admin/tasks/{taskId}/notes`
- UI: Modal or sidebar for note editing
- Activity log: Show all notes with timestamps

**Effort**: 2-3 hours

---

## Implementation Checklist

- [x] Task model created
- [x] createTask() function implemented
- [x] Auto-assignment logic (load-based)
- [x] Task type helpers (dispute, refund, etc.)
- [x] Workload tracking
- [ ] SLA breach detection cron job
- [ ] SLA escalation workflow
- [ ] Calendar sync error detection cron job
- [ ] Document expiry alert cron job
- [ ] Admin task dashboard UI
- [ ] Staff notifications (email/SMS)
- [ ] Task notes UI
- [ ] Task closure governance
- [ ] Admin approval workflow

---

## Related Features

- **Financial Ledger**: Task creation triggers ledger entries (disputes freeze payouts)
- **Governance**: closeTaskWithGovernance() validates approvals
- **Notifications**: Task assignments trigger email notifications (not yet implemented)

---

## Testing Recommendations

- ✅ Create task with autoAssign=true → Assigned to staff with lowest load
- ✅ Create task with autoAssign=false → Stays OPEN
- ✅ Staff at capacity → Task stays OPEN
- ✅ Priority HIGH → Due date 4 hours from now
- ✅ Multiple tasks created → Each increments staff.currentLoad
- ❌ SLA breached → Auto-escalate (NOT TESTED - not implemented yet)

---

## Security Notes

- Auth: Only ADMIN/SUPER_ADMIN can view/manage tasks
- Data: Contact info stored (may include PII) - ensure encrypted
- Auditability: All task changes should be logged (not yet implemented)

