# Staff Governance & Permissions

**Purpose:** Manage platform staff roles, permissions, workload, and operational governance.

**Status:** ✅ AS IS (Partially Implemented) | ⚠️ AS IT SHOULD BE (Full Permissions System)

---

## AS IS: Current Implementation

### Database Model

**Location:** `prisma/schema.prisma`

```prisma
model StaffMember {
  id                     String   @id @default(cuid())
  userId                 String   @unique
  user                   User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  name                   String
  email                  String   @unique
  department             String   // FINANCIAL | TECHNICAL | SUPPORT
  isActive               Boolean  @default(true)
  isSupervisor           Boolean  @default(false)

  // Workload tracking
  currentLoad            Int      @default(0)   // active tasks assigned
  maxCapacity            Int      @default(10)  // max concurrent tasks
  tasksCompleted         Int      @default(0)
  avgResolutionTimeHours Float?
  satisfactionScore      Float?
  skills                 Json?    // string[]

  // Permissions
  canApproveRefunds      Boolean  @default(false)
  canOverridePolicy      Boolean  @default(false)
  canAccessFinancials    Boolean  @default(false)
  maxRefundAmount        Float    @default(100)  // max refund without supervisor approval

  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt

  assignedTasks  Task[]      @relation("AssignedTasks")
  taskNotes      TaskNote[]

  @@index([department, isActive])
}
```

### Staff Departments

| Department | Responsibilities | Permissions |
|-----------|------------------|------------|
| **FINANCIAL** | Payouts, refunds, disputes, ledger | canApproveRefunds, canAccessFinancials |
| **TECHNICAL** | Settings, documents, test centers, system config | canOverridePolicy |
| **SUPPORT** | Booking issues, customer inquiries, complaints | None (read-only mostly) |

### Permission Flags

| Flag | Description | Impact |
|------|-------------|--------|
| `canApproveRefunds` | Can approve refund requests | Required for refund > `maxRefundAmount` |
| `canOverridePolicy` | Can bypass system rules | Used sparingly by TECHNICAL team |
| `canAccessFinancials` | Can view ledger, payouts, revenue | Restricted to FINANCIAL department |
| `maxRefundAmount` | Max refund without supervisor approval | Checked before payout processing |

### Workload Tracking

**Fields:**
- `currentLoad`: Active tasks assigned to staff member
- `maxCapacity`: Maximum concurrent tasks (default 10)
- `tasksCompleted`: Total tasks completed (all-time)
- `avgResolutionTimeHours`: Average time to complete task
- `satisfactionScore`: Customer satisfaction rating (optional)

**Auto-Populated:** On task creation/completion

**Load Alert:** If `currentLoad >= maxCapacity`, show warning on dashboard

### API Endpoint

**GET `/api/admin/staff-governance/stats`**

**Auth:** ADMIN only

**Response:**
```json
{
  "pendingApprovals": 5,           // instructors awaiting approval
  "disputes": 2,                   // open chargebacks
  "refundsThisWeek": 1250.00,     // week-to-date refunds
  "totalRefunds": 15000.00,        // all-time refunds
  "staffCapacity": {
    "total": 12,                   // total staff members
    "available": 8,                // not at max capacity
    "atCapacity": 4,               // busy
    "inactive": 0                  // suspended/off
  },
  "riskScores": [
    { "instructorId": "inst_123", "score": 0.85, "reason": "3 disputes in 30 days" },
    { "instructorId": "inst_456", "score": 0.92, "reason": "50% cancellation rate" }
  ]
}
```

### Current Features

**What's Working:**
- ✅ StaffMember model with department + permissions
- ✅ Workload capacity tracking
- ✅ Permission flags for refund approval
- ✅ Supervisor flag for escalation

**What's Missing:**
- ❌ Admin UI for staff management
- ❌ Role-based access control on API endpoints
- ❌ Task assignment workflow
- ❌ Approval gates based on permissions
- ❌ Workload balancing/load assignment

---

## AS IT SHOULD BE: Full Implementation

### 1. Admin Staff Management Dashboard (High Priority)

**URL:** `/admin/staff-governance`

**Features:**

1. **Staff List:**
   - Table: Name | Email | Department | Status | Load | Tasks | Actions
   - Filter by department, status (active/inactive)
   - Sort by current load, tasks completed

2. **Add/Edit Staff:**
   - Form fields:
     - Name, Email
     - Department (FINANCIAL, TECHNICAL, SUPPORT)
     - Max Capacity (default 10)
     - Permissions checkboxes
     - Max Refund Amount (if FINANCIAL)
     - Supervisor toggle
   - Pre-filled with existing values for edit

3. **Staff Details Card:**
   - Current workload (X/10 tasks)
   - Tasks completed (all-time)
   - Average resolution time
   - Satisfaction score
   - Recent activities
   - Current assigned tasks list

4. **Workload Balancing:**
   - Show available staff for new task assignment
   - "Auto-assign to least-loaded" option
   - Warn if assigning to someone already at capacity

### 2. Role-Based Access Control (High Priority)

**Issue:** All admins can do everything. Need granular permissions.

**Recommendation:** Implement permission checks on endpoints

**Example:**
```typescript
// /api/admin/payouts
if (!session.user.department === 'FINANCIAL' || !session.user.canAccessFinancials) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
}
```

**Permission Matrix:**

| Endpoint | Required Permission | Who |
|----------|-------------------|-----|
| `/api/admin/payouts/*` | canAccessFinancials | FINANCIAL |
| `/api/admin/ledger/*` | canAccessFinancials | FINANCIAL |
| `/api/admin/disputes/*` | canApproveRefunds | FINANCIAL |
| `/api/admin/settings/*` | canOverridePolicy | TECHNICAL |
| `/api/admin/documents/*` | All staff | All |
| `/api/admin/bookings/[id]/refund` | canApproveRefunds + amount < maxRefundAmount | FINANCIAL |

### 3. Approval Workflow (High Priority)

**Scenario:** SUPPORT staff requests refund > their permission level

**Workflow:**
1. SUPPORT creates refund request for $500 (max: $200)
2. System creates APPROVAL task (assigned to FINANCIAL supervisor)
3. FINANCIAL staff reviews, approves/rejects
4. If approved, refund processes; if rejected, notify SUPPORT

**Implementation:**
```typescript
if (refundAmount > staff.maxRefundAmount && !staff.isSupervisor) {
  // Create approval task
  await createApprovalTask({
    type: 'REFUND_APPROVAL',
    amount: refundAmount,
    assignedToRole: 'FINANCIAL',
    requiresSupervisor: true,
    referenceId: bookingId
  });
  return { status: 'PENDING_APPROVAL', taskId: task_xyz };
}
```

### 4. Task Management System (High Priority)

**Note:** Task model exists but needs API routes and UI

**Features:**

1. **Task Queue:**
   - Dashboard showing assigned tasks per staff member
   - Filter by status (OPEN, IN_PROGRESS, COMPLETED)
   - Sort by priority, due date, creation date

2. **Task Assignment:**
   - Assign task to staff member
   - Auto-assign to least-loaded available staff
   - Bulk assign multiple tasks

3. **Task Tracking:**
   - Status: OPEN → IN_PROGRESS → COMPLETED
   - Time tracking: created, started, completed
   - Notes/updates on task
   - Evidence/attachments

### 5. Staff Performance Metrics (Medium Priority)

**Dashboard:** `/admin/staff-performance`

**Metrics:**
- Tasks completed (this week, this month, all-time)
- Average resolution time (trend: improving or worsening?)
- Current load (X/Y capacity)
- Satisfaction score (from customers, from supervisors)
- Refund approval rate (% approved vs rejected)

**Reports:**
- Weekly performance digest
- Identify underperforming staff
- Identify overloaded staff (nearing max capacity)

### 6. Skills Tracking (Low Priority)

**Issue:** `skills` field exists but unused.

**Recommendation:**
- Add skills to staff member (e.g., ["dispute_resolution", "spanish_speaking"])
- Filter tasks by required skills when assigning
- Assign complex disputes to experienced staff only

**Example:**
```json
{
  "id": "staff_123",
  "name": "Maria",
  "department": "SUPPORT",
  "skills": ["spanish_speaking", "billing_expert", "dispute_resolution"]
}
```

When assigning dispute → find staff with "dispute_resolution" skill

### 7. Escalation Rules (Low Priority)

**Workflows:**
- Task unresolved after 24h → auto-escalate to supervisor
- Task unresolved after 48h → escalate to department manager
- Multiple escalations → alert director

### 8. Audit Trail for Staff Actions (Medium Priority)

**Track:**
- Who approved/rejected what
- When staff changed permissions
- Refunds approved (amount, reason)
- Policy overrides (what was overridden, why)

**Report:** Queryable audit trail for compliance

---

## Implementation Checklist

- [ ] Create `/admin/staff-governance` page (list, add, edit)
- [ ] Implement role-based access control on all admin endpoints
- [ ] Add permission check helper function
- [ ] Create approval workflow for high-value actions
- [ ] Implement task management (create, assign, complete)
- [ ] Add workload balancing (auto-assign to least-loaded)
- [ ] Create performance dashboard
- [ ] Add staff activity audit trail
- [ ] Implement escalation rules
- [ ] Track resolution times per staff member
- [ ] Add skills-based task assignment
- [ ] Create weekly performance digest email

---

## Testing

### Test 1: Permission Enforcement

**Setup:** Create two staff: one FINANCIAL, one SUPPORT

**Test:** Both try to access `/api/admin/ledger`

**Verify:**
- FINANCIAL staff: 200 (success)
- SUPPORT staff: 403 (Unauthorized)

### Test 2: Refund Approval Threshold

**Setup:** SUPPORT staff with maxRefundAmount=200

**Test:** Request refund for $500

**Verify:**
- Returns: `{ status: 'PENDING_APPROVAL', taskId: ... }`
- Task created and assigned to FINANCIAL
- Refund doesn't process until approved

### Test 3: Workload Capacity

**Setup:** Staff with maxCapacity=5, currently has 5 tasks

**Test:** Try to assign 6th task

**Verify:**
- Warning shown on dashboard
- Can still assign (optional override)
- Dashboard shows staff "at capacity"

---

## References

- **Schema Model:** `prisma/schema.prisma` → `StaffMember`
- **Task Model:** `prisma/schema.prisma` → `Task`, `TaskNote`
- **API Endpoint:** `app/api/admin/staff-governance/stats/route.ts`
- **User Model:** `prisma/schema.prisma` → `User` (role field)

