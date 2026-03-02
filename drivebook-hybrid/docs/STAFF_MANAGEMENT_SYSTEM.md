# Staff Management System Design

## Overview
As your platform scales (50+ instructors, hundreds of bookings), you need a structured way to manage operations. This document outlines three staff management approaches.

---

## Approach 1: Department-Based Assignment (Recommended)
**Best for: 3-10 staff members with specialized roles**

### Structure
- **Financial Team**: Handle payments, refunds, wallet issues, payouts
- **Technical Team**: Handle booking issues, calendar sync, app problems
- **Support Team**: Handle disputes, cancellations, reschedules, general inquiries

### How It Works
1. Each ticket/task is automatically categorized by type
2. Routed to the appropriate department queue
3. Next available staff in that department picks it up
4. Staff can collaborate across departments when needed

### Advantages
- ✅ Staff become experts in their domain
- ✅ Faster resolution times
- ✅ Clear escalation paths
- ✅ Easy to train new staff

### Implementation
```
Staff Member → Department → Task Queue
   Sarah    → Financial  → [Refund #123, Payout #456]
   John     → Technical  → [Calendar Sync #789, App Bug #101]
   Maria    → Support    → [Dispute #234, Reschedule #567]
```

---

## Approach 2: Instructor Assignment (Load Balanced)
**Best for: High volume with dedicated account managers**

### Structure
- Each staff member manages 15-20 instructors
- Responsible for ALL issues related to their instructors
- Automatic load balancing when new instructors join

### How It Works
1. New instructor signs up → Assigned to staff with lowest load
2. All bookings/issues for that instructor → Go to assigned staff
3. Staff builds relationship with their instructors
4. Can reassign if workload becomes unbalanced

### Advantages
- ✅ Personal relationships with instructors
- ✅ Staff understand instructor's history/context
- ✅ Accountability is clear
- ✅ Instructors have a "go-to" person

### Implementation
```
Staff Member → Assigned Instructors → All Related Tasks
   Sarah    → [Instructor A, B, C...] → [All bookings, issues, payments]
   John     → [Instructor D, E, F...] → [All bookings, issues, payments]
   Maria    → [Instructor G, H, I...] → [All bookings, issues, payments]
```

---

## Approach 3: Hybrid Queue System (Most Flexible)
**Best for: Growing teams that need flexibility**

### Structure
- Shared task queue for all staff
- Priority levels (Urgent, High, Normal, Low)
- Staff can specialize but also handle general tasks
- Smart routing based on staff skills and availability

### How It Works
1. All tasks go into a central queue
2. Tasks are tagged with type, priority, and required skills
3. Staff see tasks they're qualified for
4. They pick tasks based on priority and their capacity
5. System suggests next task based on staff expertise

### Advantages
- ✅ No bottlenecks (anyone can help)
- ✅ Flexible during busy periods
- ✅ Staff can develop multiple skills
- ✅ Easy to scale up/down

### Implementation
```
Central Queue → Smart Routing → Available Staff
[Task #123: Financial, High Priority] → Sarah (Financial Expert)
[Task #456: Technical, Urgent] → John (Available Now)
[Task #789: Support, Normal] → Maria (Lowest Workload)
```

---

## Task Categories & Priorities

### Financial Tasks
- Refund requests (High)
- Payment disputes (Urgent)
- Wallet adjustments (Normal)
- Payout processing (High)
- Invoice issues (Normal)

### Technical Tasks
- Calendar sync failures (High)
- App crashes (Urgent)
- Booking system errors (Urgent)
- Integration issues (High)
- Feature requests (Low)

### Support Tasks
- Cancellation requests (Normal)
- Reschedule requests (Normal)
- Disputes between client/instructor (High)
- General inquiries (Low)
- Complaint handling (High)

---

## Recommended Implementation Plan

### Phase 1: Start with Department-Based (3 staff)
1. Hire 3 staff members (1 per department)
2. Set up task categorization
3. Create department queues
4. Train staff on their domain

### Phase 2: Add Load Balancing (5-7 staff)
1. Add 2-4 more staff members
2. Implement round-robin assignment within departments
3. Add workload monitoring
4. Enable cross-department collaboration

### Phase 3: Scale to Hybrid (8+ staff)
1. Implement central queue system
2. Add skill-based routing
3. Enable staff to pick tasks
4. Add performance metrics

---

## Key Features to Build

### 1. Task Management Dashboard
- View all open tasks
- Filter by department/priority/status
- Assign/reassign tasks
- Add notes and updates
- Track resolution time

### 2. Instructor Assignment System
- View staff workload
- Assign instructors to staff
- Rebalance assignments
- View staff performance

### 3. Automated Routing
- Auto-categorize tasks by type
- Route to appropriate queue
- Escalate urgent issues
- Send notifications

### 4. Performance Metrics
- Average resolution time
- Tasks completed per staff
- Customer satisfaction scores
- Response time tracking

### 5. Collaboration Tools
- Internal notes on tasks
- Tag other staff for help
- Escalation workflow
- Knowledge base

---

## Database Schema Changes Needed

### New Models

```prisma
model StaffMember {
  id            String   @id @default(auto()) @map("_id") @db.ObjectId
  userId        String   @unique @db.ObjectId
  user          User     @relation(fields: [userId], references: [id])
  
  name          String
  email         String
  department    StaffDepartment
  isActive      Boolean  @default(true)
  
  // Workload tracking
  maxCapacity   Int      @default(20) // Max concurrent tasks
  currentLoad   Int      @default(0)
  
  // Skills
  skills        String[] // ["financial", "technical", "support"]
  
  // Performance
  tasksCompleted Int     @default(0)
  avgResolutionTime Float? // In hours
  satisfactionScore Float?
  
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  assignedInstructors InstructorAssignment[]
  tasks         Task[]
  notes         TaskNote[]
}

enum StaffDepartment {
  FINANCIAL
  TECHNICAL
  SUPPORT
  GENERAL
}

model InstructorAssignment {
  id            String   @id @default(auto()) @map("_id") @db.ObjectId
  staffId       String   @db.ObjectId
  staff         StaffMember @relation(fields: [staffId], references: [id])
  instructorId  String   @db.ObjectId
  instructor    Instructor @relation(fields: [instructorId], references: [id])
  
  assignedAt    DateTime @default(now())
  isActive      Boolean  @default(true)
  
  @@unique([staffId, instructorId])
}

model Task {
  id            String   @id @default(auto()) @map("_id") @db.ObjectId
  
  // Task details
  type          TaskType
  category      TaskCategory
  priority      TaskPriority
  status        TaskStatus @default(OPEN)
  
  title         String
  description   String
  
  // Relationships
  instructorId  String?  @db.ObjectId
  clientId      String?  @db.ObjectId
  bookingId     String?  @db.ObjectId
  
  // Assignment
  assignedToId  String?  @db.ObjectId
  assignedTo    StaffMember? @relation(fields: [assignedToId], references: [id])
  assignedAt    DateTime?
  
  // Resolution
  resolvedAt    DateTime?
  resolvedBy    String?  @db.ObjectId
  resolution    String?
  
  // Tracking
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  dueDate       DateTime?
  
  notes         TaskNote[]
  
  @@index([status, priority])
  @@index([assignedToId])
  @@index([type, category])
}

enum TaskType {
  BOOKING_ISSUE
  CANCELLATION
  RESCHEDULE
  REFUND
  PAYMENT_DISPUTE
  TECHNICAL_ISSUE
  CALENDAR_SYNC
  DOCUMENT_VERIFICATION
  GENERAL_INQUIRY
  COMPLAINT
  PAYOUT_REQUEST
}

enum TaskCategory {
  FINANCIAL
  TECHNICAL
  SUPPORT
}

enum TaskPriority {
  URGENT    // Resolve within 1 hour
  HIGH      // Resolve within 4 hours
  NORMAL    // Resolve within 24 hours
  LOW       // Resolve within 3 days
}

enum TaskStatus {
  OPEN
  IN_PROGRESS
  WAITING_RESPONSE
  RESOLVED
  CLOSED
}

model TaskNote {
  id            String   @id @default(auto()) @map("_id") @db.ObjectId
  taskId        String   @db.ObjectId
  task          Task     @relation(fields: [taskId], references: [id])
  
  staffId       String   @db.ObjectId
  staff         StaffMember @relation(fields: [staffId], references: [id])
  
  note          String
  isInternal    Boolean  @default(true) // Internal notes vs customer-facing
  
  createdAt     DateTime @default(now())
  
  @@index([taskId])
}
```

---

## Quick Start Guide

### For 3 Staff Members (Starting Point)

**Staff 1: Financial Manager**
- Handle all wallet/payment issues
- Process refunds and payouts
- Resolve payment disputes
- Monitor financial integrity

**Staff 2: Technical Support**
- Fix booking system issues
- Resolve calendar sync problems
- Handle app/website bugs
- Manage integrations

**Staff 3: Customer Support**
- Handle cancellations/reschedules
- Resolve disputes
- Answer general inquiries
- Manage complaints

### Daily Workflow
1. Staff logs in to admin dashboard
2. Views their department queue
3. Picks highest priority task
4. Works on resolution
5. Updates task status
6. Moves to next task

### Escalation Rules
- Urgent tasks: Notify all staff immediately
- High priority: Assign within 15 minutes
- Normal: Assign within 1 hour
- Low: Assign within 4 hours

---

## Next Steps

1. **Choose your approach** (I recommend Department-Based for 3 staff)
2. **I'll implement the database schema changes**
3. **Build the staff dashboard**
4. **Create task management system**
5. **Set up automated routing**
6. **Add performance tracking**

Would you like me to implement this system? Which approach do you prefer?
