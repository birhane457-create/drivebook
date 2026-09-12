/**
 * lib/extensions/driving/index.ts
 *
 * Entry point for the driving domain extension.
 *
 * This module wires the driving-specific capabilities into the Core
 * extension hook system. Core calls these hooks at defined points —
 * it never imports this module directly except through the extension registry.
 *
 * What lives here:
 *   - PDA assessment scoring and feedback codes
 *   - Lesson outcome recording
 *   - PDA test booking service
 *   - Availability slot blocking for PDA tests
 *   - Onboarding email sequence for driving instructors
 *   - Provider registration fields (car, licence, compliance docs)
 *   - Admin nav items (Test Centres)
 *
 * What does NOT live here (belongs in Core + BusinessConfig):
 *   - Booking creation, payment, scheduling — Core
 *   - Notification delivery — Core
 *   - RBAC, auth, session — Core
 *   - Subscription billing — Core
 */

import type { DomainExtension, TimeSlot, AvailabilityContext, FieldDefinition, NavItem } from '@/lib/core/types'
import { drivingPaymentExtension } from './payment-extension'

// ── Slot blocker ──────────────────────────────────────────────────────────────
// Blocks availability slots that overlap a PDA test booking.
// This replaces the hardcoded `bookingType: 'PDA_TEST'` check that was
// previously inside the core AvailabilityService.

async function getPDATestsForProvider(
  providerId: string,
  date: Date
): Promise<Array<{ startTime: Date; duration: number }>> {
  try {
    const { prisma } = await import('@/lib/prisma')
    const dateStr = date.toISOString().slice(0, 10)
    const startOfDay = new Date(`${dateStr}T00:00:00.000Z`)
    const endOfDay = new Date(`${dateStr}T23:59:59.999Z`)

    const pdaBookings = await prisma.booking.findMany({
      where: {
        providerId,
        bookingType: 'PDA_TEST' as any,
        startTime: { gte: startOfDay, lte: endOfDay },
        status: { in: ['CONFIRMED', 'PENDING'] },
      },
      select: { startTime: true, duration: true },
    }) as any[]

    return pdaBookings
      .filter((b: any) => b.startTime !== null)
      .map((b: any) => ({
        startTime: b.startTime!,
        duration: (b.duration as number) ?? 165,
      }))
  } catch {
    return []
  }
}

// ── Provider registration fields ──────────────────────────────────────────────

function drivingProviderFields(): FieldDefinition[] {
  return [
    { key: 'licenseNumber',          label: 'Driving Instructor Authority Number', type: 'text',    required: true  },
    { key: 'licenseExpiry',          label: 'Authority Expiry Date',               type: 'date',    required: true  },
    { key: 'licenseImageFront',      label: 'Authority Card (Front)',               type: 'file',    required: true,  acceptedFileTypes: ['image/*', 'application/pdf'] },
    { key: 'licenseImageBack',       label: 'Authority Card (Back)',                type: 'file',    required: false, acceptedFileTypes: ['image/*', 'application/pdf'] },
    { key: 'wwcCheckDoc',            label: 'Working With Children Check',          type: 'file',    required: true,  acceptedFileTypes: ['image/*', 'application/pdf'] },
    { key: 'wwcCheckExpiry',         label: 'WWC Expiry Date',                      type: 'date',    required: true  },
    { key: 'policeCheckDoc',         label: 'National Police Clearance',            type: 'file',    required: true,  acceptedFileTypes: ['image/*', 'application/pdf'] },
    { key: 'policeCheckExpiry',      label: 'Police Check Expiry Date',             type: 'date',    required: true  },
    { key: 'insurancePolicyDoc',     label: 'Public Liability Insurance',           type: 'file',    required: true,  acceptedFileTypes: ['image/*', 'application/pdf'] },
    { key: 'insuranceExpiry',        label: 'Insurance Expiry Date',               type: 'date',    required: true  },
    { key: 'vehicleRegistrationDoc', label: 'Vehicle Registration',                 type: 'file',    required: true,  acceptedFileTypes: ['image/*', 'application/pdf'] },
    { key: 'carMake',                label: 'Car Make',                             type: 'text',    required: true  },
    { key: 'carModel',               label: 'Car Model',                            type: 'text',    required: true  },
    { key: 'carYear',                label: 'Car Year',                             type: 'text',    required: true  },
    { key: 'vehicleTypes',           label: 'Transmission Types Offered',           type: 'select',  required: true,
      options: ['Manual', 'Automatic', 'Manual & Automatic'] },
  ]
}

// ── Booking outcome fields ────────────────────────────────────────────────────

function drivingOutcomeFields(): FieldDefinition[] {
  return [
    { key: 'assessmentType', label: 'Session Type',       type: 'select', required: true,
      options: ['COACHING', 'MOCK', 'OFFICIAL'] },
    { key: 'lessonTopics',   label: 'Topics Covered',     type: 'text',   required: false },
    { key: 'passed',         label: 'Pass / Fail',        type: 'boolean',required: false },
    { key: '(performanceScore as any)', label: 'Performance Score (0–100)', type: 'text', required: false },
    { key: 'instructorNotes', label: 'Instructor Notes',  type: 'text',   required: false },
  ]
}

// ── Admin nav items ───────────────────────────────────────────────────────────

function drivingAdminNavItems(): NavItem[] {
  return [
    { label: 'Test Centres', href: '/admin/test-centres', icon: 'MapPin' },
  ]
}

// ── DomainExtension export ────────────────────────────────────────────────────

export const drivingExtension: DomainExtension = {
  slug: 'driving',

  hooks: {
    additionalSlotBlocker: (slot: TimeSlot, ctx: AvailabilityContext): boolean => {
      const pdaTests = (ctx as any).__drivingPDATests as Array<{
        startTime: Date
        duration: number
      }> | undefined

      if (!pdaTests || pdaTests.length === 0) return false

      return pdaTests.some((test) => {
        const testStart = new Date(test.startTime)
        const bufferBefore = 30
        const testEnd = new Date(testStart.getTime() + test.duration * 60 * 1000)
        const blockedFrom = new Date(testStart.getTime() - bufferBefore * 60 * 1000)
        return slot.start < testEnd && slot.end > blockedFrom
      })
    },

    providerProfileFields: drivingProviderFields,

    bookingOutcomeFields: drivingOutcomeFields,

    adminNavItems: drivingAdminNavItems,

    onBookingCreated: async (bookingId: string, _data: unknown): Promise<void> => {
      // placeholder — outcome recorded separately via lesson-feedback API
    },
  },

  // Driving vertical uses the marketplace payment model:
  // Platform collects customer funds and pays providers via Stripe Connect.
  // All other verticals leave paymentExtension undefined — providers charge
  // customers directly and the platform earns via SaaS subscription only.
  paymentExtension: drivingPaymentExtension,
}

// ── Re-exports for direct use by driving-specific routes ──────────────────────

export { pdaService } from './pda-service'
export * from './pda-feedback-codes'
export * from './lesson-feedback-service'
export * from './feedback-codes'
