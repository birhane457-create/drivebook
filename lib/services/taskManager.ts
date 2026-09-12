// @ts-nocheck
import { DEFAULT_TIMEZONE } from '@/lib/utils/timezone';
import { prisma } from '@/lib/prisma';
import { TaskType } from '@prisma/client';

interface CreateTaskParams {
  type: TaskType;
  category: 'FINANCIAL' | 'TECHNICAL' | 'SUPPORT';
  priority: 'URGENT' | 'HIGH' | 'NORMAL' | 'LOW';
  title: string;
  description: string;
  providerId?: string;
  customerId?: string;
  bookingId?: string;
  userId?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  autoAssign?: boolean;
}

/**
 * Create a new task and optionally auto-assign to available staff
 */
export async function createTask(params: CreateTaskParams) {
  const {
    type,
    category,
    priority,
    title,
    description,
    providerId,
    customerId,
    bookingId,
    userId,
    contactName,
    contactEmail,
    contactPhone,
    autoAssign = true
  } = params;

  // Calculate due date based on priority
  const now = new Date();
  let dueDate = new Date(now);
  
  switch (priority) {
    case 'URGENT':
      dueDate.setHours(now.getHours() + 1);
      break;
    case 'HIGH':
      dueDate.setHours(now.getHours() + 4);
      break;
    case 'NORMAL':
      dueDate.setHours(now.getHours() + 24);
      break;
    case 'LOW':
      dueDate.setDate(now.getDate() + 3);
      break;
  }

  // Auto-assign to staff member if enabled
  let assignedToId = null;
  let assignedAt = null;
  
  if (autoAssign) {
    // Find staff member with lowest load in the appropriate department
    const availableStaff = await prisma.staffMember.findFirst({
      where: {
        department: category,
        isActive: true,
        currentLoad: { lt: prisma.staffMember.fields.maxCapacity }
      },
      orderBy: { currentLoad: 'asc' }
    });

    if (availableStaff) {
      assignedToId = availableStaff.id;
      assignedAt = new Date();
      
      // Increment staff load
      await prisma.staffMember.update({
        where: { id: availableStaff.id },
        data: { currentLoad: { increment: 1 } }
      });
    }
  }

  // Create the task
  const task = await prisma.task.create({
    data: {
      type,
      category,
      priority,
      title,
      description,
      providerId,
      customerId,
      bookingId,
      userId,
      contactName,
      contactEmail,
      contactPhone,
      assignedToId,
      assignedAt,
      autoAssigned: autoAssign && !!assignedToId,
      dueDate,
      status: assignedToId ? 'ASSIGNED' : 'OPEN'
    }
  });

  return task;
}

/**
 * Auto-create task for refund request
 */
export async function createRefundTask(params: {
  bookingId: string;
  customerId: string;
  amount: number;
  reason: string;
  contactName: string;
  contactEmail: string;
}) {
  return createTask({
    type: 'REFUND_REQUEST',
    category: 'FINANCIAL',
    priority: 'HIGH',
    title: `Refund Request - ${params.contactName}`,
    description: `Refund request for $${params.amount}. Reason: ${params.reason}`,
    bookingId: params.bookingId,
    customerId: params.customerId,
    contactName: params.contactName,
    contactEmail: params.contactEmail,
    autoAssign: true
  });
}

/**
 * Auto-create task for calendar sync error
 */
export async function createCalendarSyncTask(params: {
  providerId: string;
  instructorName: string;
  instructorEmail: string;
  error: string;
}) {
  return createTask({
    type: 'CALENDAR_SYNC_ERROR',
    category: 'TECHNICAL',
    priority: 'HIGH',
    title: `Calendar Sync Error - ${params.instructorName}`,
    description: `Calendar synchronization failed. Error: ${params.error}`,
    providerId: params.providerId,
    contactName: params.instructorName,
    contactEmail: params.instructorEmail,
    autoAssign: true
  });
}

/**
 * Auto-create task for payment dispute
 */
export async function createPaymentDisputeTask(params: {
  customerId: string;
  bookingId?: string;
  amount: number;
  reason: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
}) {
  return createTask({
    type: 'PAYMENT_DISPUTE',
    category: 'FINANCIAL',
    priority: 'URGENT',
    title: `Payment Dispute - ${params.contactName}`,
    description: `Payment dispute for $${params.amount}. Reason: ${params.reason}`,
    customerId: params.customerId,
    bookingId: params.bookingId,
    contactName: params.contactName,
    contactEmail: params.contactEmail,
    contactPhone: params.contactPhone,
    autoAssign: true
  });
}

/**
 * Auto-create task for booking system error
 */
export async function createBookingErrorTask(params: {
  error: string;
  bookingId?: string;
  providerId?: string;
  customerId?: string;
}) {
  return createTask({
    type: 'BOOKING_ISSUE',
    category: 'TECHNICAL',
    priority: 'URGENT',
    title: 'Booking System Error',
    description: `Critical booking error: ${params.error}`,
    bookingId: params.bookingId,
    providerId: params.providerId,
    customerId: params.customerId,
    autoAssign: true
  });
}

/**
 * Auto-create task for document expiry
 */
export async function createDocumentExpiryTask(params: {
  providerId: string;
  instructorName: string;
  instructorEmail: string;
  documentType: string;
  expiryDate: Date;
}) {
  const daysUntilExpiry = Math.floor(
    (params.expiryDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
  );

  return createTask({
    type: 'DOCUMENT_EXPIRY',
    category: 'SUPPORT',
    priority: daysUntilExpiry <= 7 ? 'URGENT' : daysUntilExpiry <= 30 ? 'HIGH' : 'NORMAL',
    title: `Document Expiring - ${params.instructorName}`,
    description: `${params.documentType} expires in ${daysUntilExpiry} days (${params.expiryDate.toLocaleDateString('en-AU', { timeZone: DEFAULT_TIMEZONE })})`,
    providerId: params.providerId,
    contactName: params.instructorName,
    contactEmail: params.instructorEmail,
    autoAssign: true
  });
}

/**
 * Auto-create task for general complaint
 */
export async function createComplaintTask(params: {
  title: string;
  description: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  providerId?: string;
  customerId?: string;
  bookingId?: string;
}) {
  return createTask({
    type: 'COMPLAINT',
    category: 'SUPPORT',
    priority: 'HIGH',
    ...params,
    autoAssign: true
  });
}
