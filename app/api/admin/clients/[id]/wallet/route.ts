import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { reconcileWalletBalance } from '@/lib/services/wallet-helpers'
import { requirePermission } from '@/lib/auth/requireRole'
import { PERM } from '@/lib/rbac/permissions'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    const deny = await requirePermission(session, PERM.USERS_CUSTOMERS_VIEW)
    if (deny) return deny

    // The ID could be a client ID or user ID — try client first
    let userId: string | null = null
    let customerName = 'Unknown'

    const client = await prisma.customer.findUnique({
      where: { id: params.id },
      select: { id: true, userId: true, name: true, phone: true, notes: true, preferredProviderId: true },
    })

    if (client) {
      userId = client.userId
      customerName = client.name
    } else {
      userId = params.id
    }

    if (!userId) {
      return NextResponse.json({ error: 'Client has no associated user account' }, { status: 404 })
    }

    // Reconcile stored balance against ledger — auto-corrects any drift
    const reconciliation = await reconcileWalletBalance(userId)

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        createdAt: true,
        wallet: {
          select: {
            id: true,
            balance: true,
            transactions: {
              select: { id: true, amount: true, type: true, description: true, createdAt: true, status: true },
              orderBy: { createdAt: 'desc' },
              take: 50,
            },
          },
        },
        customers: {
          select: {
            bookings: {
              select: {
                id: true, startTime: true, endTime: true, notes: true,
                status: true, price: true, providerId: true,
                provider: { select: { name: true } },
              },
              orderBy: { startTime: 'desc' },
            },
          },
        },
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const allBookings = (user as any).customers?.flatMap((c: any) => c.bookings) ?? []

    // Resolve current instructor
    let currentInstructor: { id: string; name: string; hourlyRate: number } | null = null
    if (client) {
      let providerId = client.preferredProviderId ?? null
      if (!providerId && allBookings.length > 0) {
        const latest = allBookings.find((b: any) => b.status === 'CONFIRMED' || b.status === 'COMPLETED')
        providerId = (latest as any)?.providerId ?? null
      }
      if (providerId) {
        currentInstructor = await prisma.provider.findUnique({
          where: { id: providerId },
          select: { id: true, name: true, hourlyRate: true },
        })
      }
    }

    // Use ledger-derived balance (authoritative) — reconcileWalletBalance already corrected stored field
    const transactions = (user.wallet?.transactions ?? []).filter((t) => t.status === 'CONFIRMED')
    const totalPaid    = transactions.filter((t) => t.type === 'CREDIT').reduce((s: any, t: any) => s + t.amount, 0)
    const totalSpent   = transactions.filter((t) => t.type === 'DEBIT').reduce((s: any, t: any) => s + t.amount, 0)
    const balance      = totalPaid - totalSpent

    return NextResponse.json({
      customerId: client?.id ?? params.id,
      user: {
        id: user.id,
        name: customerName,
        email: user.email,
        phone: client?.phone ?? '',
        notes: client?.notes ?? '',
        createdAt: user.createdAt,
      },
      wallet: {
        id: user.wallet?.id,
        balance,
        totalPaid,
        totalSpent,
        creditsRemaining: balance,
        transactions: user.wallet?.transactions ?? [],
        // Surface reconciliation info so admin can see if drift was corrected
        reconciliation: reconciliation.drift !== 0 ? {
          driftCorrected: reconciliation.corrected,
          driftAmount: reconciliation.drift,
        } : null,
      },
      bookings: allBookings.map((b: any) => ({
        id: b.id, startTime: b.startTime, endTime: b.endTime,
        notes: b.notes, status: b.status, price: b.price, instructor: b.provider,
      })),
      currentInstructor,
    })
  } catch (error) {
    console.error('Get client wallet error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
