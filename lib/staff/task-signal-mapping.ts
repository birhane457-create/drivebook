/**
 * Task Priority → Signal Severity Mapping
 * 
 * Reconciles staff dashboard task priorities with the canonical Signal schema.
 * 
 * Design:
 * - Task.priority is stored as String in DB ('URGENT', 'HIGH', 'NORMAL', 'LOW')
 * - Signal.severity is canonical enum ('critical', 'high', 'medium', 'low', 'info')
 * - This mapping provides single source of truth for how task urgency maps to operational urgency
 */

import { SignalSeverity, Signal, SignalSource } from '@/lib/types/signal'

/**
 * Task priority string values (from Prisma Task.priority field)
 */
export type TaskPriority = 'URGENT' | 'HIGH' | 'NORMAL' | 'LOW'

/**
 * Task status string values (from Prisma Task.status field)
 */
export type TaskStatus = 
  | 'OPEN' 
  | 'ASSIGNED' 
  | 'IN_PROGRESS' 
  | 'WAITING_RESPONSE' 
  | 'RESOLVED' 
  | 'CLOSED'

/**
 * Map task priority to Signal severity
 * 
 * URGENT  → critical  (blocking revenue/operations, immediate action)
 * HIGH    → high      (urgent but not blocking, resolve same day)
 * NORMAL  → medium    (standard priority, resolve this week)
 * LOW     → low       (nice-to-have, resolve when capacity allows)
 */
export function taskPriorityToSeverity(priority: string): SignalSeverity {
  switch (priority) {
    case 'URGENT':  return 'critical'
    case 'HIGH':    return 'high'
    case 'NORMAL':  return 'medium'
    case 'LOW':     return 'low'
    default:        return 'low' // Unknown priorities default to low
  }
}

/**
 * Map task category to Signal source
 */
export function taskCategoryToSource(category: string): SignalSource {
  switch (category) {
    case 'FINANCIAL':   return 'finance'
    case 'TECHNICAL':   return 'operations'
    case 'SUPPORT':     return 'client'
    case 'COMPLIANCE':  return 'compliance'
    default:            return 'staff'
  }
}

/**
 * Convert a Task record to a Signal for unified rendering
 * 
 * This enables tasks to be displayed alongside operational alerts
 * in AttentionItemList or any other Signal-consuming component.
 */
export function taskToSignal(task: {
  id: string
  title: string
  description: string
  priority: string
  status: string
  category: string
  dueDate: string | Date
  createdAt: string | Date
  assignedTo?: { name: string } | null
}): Signal {
  return {
    id: task.id,
    severity: taskPriorityToSeverity(task.priority),
    source: taskCategoryToSource(task.category),
    title: task.title,
    description: task.description,
    link: `/staff/tasks/${task.id}`,
    createdAt: task.createdAt,
    owner: task.assignedTo?.name,
    // Include task-specific metadata for filtering
    count: undefined, // Tasks don't aggregate like "5 stuck bookings"
  }
}

/**
 * Styling helpers for task priority badges
 * These now derive from Signal severity colors to maintain consistency
 */
export const TASK_PRIORITY_STYLES: Record<TaskPriority, {
  badge: string
  iconColor: string
  severity: SignalSeverity
}> = {
  URGENT: {
    badge: 'bg-destructive/15 text-destructive border border-destructive/30',
    iconColor: 'text-destructive',
    severity: 'critical',
  },
  HIGH: {
    badge: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
    iconColor: 'text-amber-400',
    severity: 'high',
  },
  NORMAL: {
    badge: 'bg-primary/15 text-primary border border-primary/30',
    iconColor: 'text-primary',
    severity: 'medium',
  },
  LOW: {
    badge: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
    iconColor: 'text-emerald-400',
    severity: 'low',
  },
}

/**
 * Styling helpers for task status badges
 */
export const TASK_STATUS_STYLES: Record<TaskStatus, string> = {
  OPEN:             'bg-primary/15 text-primary',
  ASSIGNED:         'bg-violet-500/15 text-violet-400',
  IN_PROGRESS:      'bg-indigo-500/15 text-indigo-400',
  WAITING_RESPONSE: 'bg-amber-500/15 text-amber-400',
  RESOLVED:         'bg-emerald-500/15 text-emerald-400',
  CLOSED:           'bg-secondary text-muted-foreground',
}
