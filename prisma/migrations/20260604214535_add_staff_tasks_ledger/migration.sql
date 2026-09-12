-- Migration: add_staff_tasks_ledger
-- Adds StaffMember, Task, TaskNote, FinancialLedger models
-- Also adds staffMember relation to User

-- StaffMember
CREATE TABLE "StaffMember" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSupervisor" BOOLEAN NOT NULL DEFAULT false,
    "currentLoad" INTEGER NOT NULL DEFAULT 0,
    "maxCapacity" INTEGER NOT NULL DEFAULT 10,
    "tasksCompleted" INTEGER NOT NULL DEFAULT 0,
    "avgResolutionTimeHours" DOUBLE PRECISION,
    "satisfactionScore" DOUBLE PRECISION,
    "skills" JSONB,
    "canApproveRefunds" BOOLEAN NOT NULL DEFAULT false,
    "canOverridePolicy" BOOLEAN NOT NULL DEFAULT false,
    "canAccessFinancials" BOOLEAN NOT NULL DEFAULT false,
    "maxRefundAmount" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffMember_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StaffMember_userId_key" ON "StaffMember"("userId");
CREATE UNIQUE INDEX "StaffMember_email_key" ON "StaffMember"("email");
CREATE INDEX "StaffMember_department_isActive_idx" ON "StaffMember"("department", "isActive");

ALTER TABLE "StaffMember" ADD CONSTRAINT "StaffMember_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Task
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "instructorId" TEXT,
    "clientId" TEXT,
    "bookingId" TEXT,
    "userId" TEXT,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "assignedToId" TEXT,
    "assignedAt" TIMESTAMP(3),
    "autoAssigned" BOOLEAN NOT NULL DEFAULT false,
    "dueDate" TIMESTAMP(3),
    "financialAmount" DOUBLE PRECISION,
    "financialImpact" JSONB,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "firstResponseAt" TIMESTAMP(3),
    "slaBreached" BOOLEAN NOT NULL DEFAULT false,
    "slaBreachReason" TEXT,
    "resolutionTimeHours" DOUBLE PRECISION,
    "escalatedAt" TIMESTAMP(3),
    "escalatedTo" TEXT,
    "escalationReason" TEXT,
    "escalationCount" INTEGER NOT NULL DEFAULT 0,
    "autoEscalated" BOOLEAN NOT NULL DEFAULT false,
    "resolution" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "closedAt" TIMESTAMP(3),
    "closedBy" TEXT,
    "linkedEntityVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Task_status_priority_idx" ON "Task"("status", "priority");
CREATE INDEX "Task_instructorId_idx" ON "Task"("instructorId");
CREATE INDEX "Task_bookingId_idx" ON "Task"("bookingId");
CREATE INDEX "Task_assignedToId_idx" ON "Task"("assignedToId");

ALTER TABLE "Task" ADD CONSTRAINT "Task_assignedToId_fkey"
    FOREIGN KEY ("assignedToId") REFERENCES "StaffMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- TaskNote
CREATE TABLE "TaskNote" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT true,
    "attachments" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TaskNote_taskId_idx" ON "TaskNote"("taskId");

ALTER TABLE "TaskNote" ADD CONSTRAINT "TaskNote_taskId_fkey"
    FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TaskNote" ADD CONSTRAINT "TaskNote_staffId_fkey"
    FOREIGN KEY ("staffId") REFERENCES "StaffMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- FinancialLedger
CREATE TABLE "FinancialLedger" (
    "id" TEXT NOT NULL,
    "debitAccount" TEXT NOT NULL,
    "creditAccount" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "description" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "bookingId" TEXT,
    "transactionId" TEXT,
    "payoutId" TEXT,
    "userId" TEXT,
    "instructorId" TEXT,
    "metadata" JSONB,
    "createdBy" TEXT NOT NULL DEFAULT 'SYSTEM',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancialLedger_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FinancialLedger_idempotencyKey_key" ON "FinancialLedger"("idempotencyKey");
CREATE INDEX "FinancialLedger_bookingId_idx" ON "FinancialLedger"("bookingId");
CREATE INDEX "FinancialLedger_instructorId_idx" ON "FinancialLedger"("instructorId");
CREATE INDEX "FinancialLedger_userId_idx" ON "FinancialLedger"("userId");
CREATE INDEX "FinancialLedger_createdAt_idx" ON "FinancialLedger"("createdAt");
