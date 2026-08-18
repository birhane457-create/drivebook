/**
 * POST /api/admin/instructors/[id]/payment-mode
 *
 * Activates or deactivates DIRECT payment mode for an instructor.
 *
 * DIRECT mode = BUSINESS account, commission-free.
 * Student payments go straight to the instructor's Stripe Connect account.
 * DriveBook earns via flat subscription fee only.
 *
 * Requirements for DIRECT activation:
 *   - instructor must have stripeAccountId set (Stripe Connect onboarded)
 *   - instructor must have chargesEnabled = true
 *   - SUPER_ADMIN only (financial configuration change)
 *
 * Body:
 *   { paymentMode: 'DIRECT' | 'PLATFORM', accountType?: 'BUSINESS' | 'INDIVIDUAL' }
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const schema = z.object({
  paymentMode: z.enum(['DIRECT', 'PLATFORM']),
  accountType: z.enum(['BUSINESS', 'INDIVIDUAL']).optional(),
})

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    // Payment mode is a financial configuration — SUPER_ADMIN only
    if (session?.user?.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'SUPER_ADMIN required' }, { status: 403 })
    }

    const body = await req.json()
    const { paymentMode, accountType } = schema.parse(body)

    const instructor = await prisma.instructor.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        name: true,
        stripeAccountId: true,
        chargesEnabled: true,
        paymentMode: true,
        accountType: true,
        subscriptionTier: true,
      },
    })

    if (!instructor) {
      return NextResponse.json({ error: 'Instructor not found' }, { status: 404 })
    }

    // ── DIRECT mode pre-flight checks ────────────────────────────────────────
    if (paymentMode === 'DIRECT') {
      if (!instructor.stripeAccountId) {
        return NextResponse.json({
          error: 'Cannot activate DIRECT mode: instructor has not connected a Stripe account.',
          code: 'STRIPE_CONNECT_MISSING',
          required: 'Instructor must complete Stripe Connect onboarding first.',
        }, { status: 422 })
      }

      if (!instructor.chargesEnabled) {
        return NextResponse.json({
          error: 'Cannot activate DIRECT mode: Stripe Connect account not yet enabled for charges.',
          code: 'STRIPE_CONNECT_NOT_READY',
          stripeAccountId: instructor.stripeAccountId,
          required: 'Instructor must complete Stripe Connect verification.',
        }, { status: 422 })
      }
    }

    // ── Update instructor ─────────────────────────────────────────────────────
    const updateData: Record<string, string> = { paymentMode }

    // When activating DIRECT, default accountType to BUSINESS if not specified
    if (accountType) {
      updateData.accountType = accountType
    } else if (paymentMode === 'DIRECT' && instructor.accountType !== 'BUSINESS') {
      updateData.accountType = 'BUSINESS'
    } else if (paymentMode === 'PLATFORM' && instructor.accountType === 'BUSINESS') {
      // Reverting to PLATFORM — optionally reset to INDIVIDUAL (explicit opt-in)
      // Keep BUSINESS if not specified — admin may want to keep branding without direct payments
    }

    await prisma.instructor.update({
      where: { id: params.id },
      data: updateData as any,
    })

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: paymentMode === 'DIRECT' ? 'PAYMENT_MODE_DIRECT_ACTIVATED' : 'PAYMENT_MODE_PLATFORM_RESTORED',
        actorId: session.user.id!,
        actorRole: 'SUPER_ADMIN',
        targetType: 'INSTRUCTOR',
        targetId: params.id,
        success: true,
        metadata: {
          previousPaymentMode: instructor.paymentMode,
          newPaymentMode: paymentMode,
          previousAccountType: instructor.accountType,
          newAccountType: updateData.accountType ?? instructor.accountType,
          stripeAccountId: instructor.stripeAccountId,
        } as any,
      },
    })

    return NextResponse.json({
      success: true,
      instructor: {
        id: instructor.id,
        name: instructor.name,
        paymentMode,
        accountType: updateData.accountType ?? instructor.accountType,
      },
      message: paymentMode === 'DIRECT'
        ? `DIRECT mode activated for ${instructor.name}. Student payments now go to their Stripe account. Zero commission.`
        : `PLATFORM mode restored for ${instructor.name}. Standard commission applies.`,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    console.error('[payment-mode] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * GET /api/admin/instructors/[id]/payment-mode
 * Returns current payment mode status for an instructor.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (session?.user?.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'SUPER_ADMIN required' }, { status: 403 })
  }

  const instructor = await prisma.instructor.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      name: true,
      paymentMode: true,
      accountType: true,
      stripeAccountId: true,
      chargesEnabled: true,
      subscriptionTier: true,
    },
  })

  if (!instructor) {
    return NextResponse.json({ error: 'Instructor not found' }, { status: 404 })
  }

  const canActivateDirect = !!(instructor.stripeAccountId && instructor.chargesEnabled)

  return NextResponse.json({
    id: instructor.id,
    name: instructor.name,
    paymentMode: instructor.paymentMode ?? 'PLATFORM',
    accountType: instructor.accountType ?? 'INDIVIDUAL',
    stripeConnected: !!instructor.stripeAccountId,
    chargesEnabled: instructor.chargesEnabled,
    canActivateDirect,
    subscriptionTier: instructor.subscriptionTier,
    readyForDirect: canActivateDirect && instructor.subscriptionTier === 'BUSINESS',
  })
}
