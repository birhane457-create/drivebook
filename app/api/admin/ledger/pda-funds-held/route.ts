import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { requirePermission } from '@/lib/auth/requireRole'
import { PERM } from '@/lib/rbac/permissions'
import { getPdaFundsHeldReconciliation } from '@/lib/services/pda-financial-operations'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    const denied = await requirePermission(session, PERM.FINANCE_REVENUE_VIEW)
    if (denied) return denied

    return NextResponse.json(await getPdaFundsHeldReconciliation())
  } catch (error) {
    console.error('[PDA funds held report] Failed to reconcile PDA financial records:', error)
    return NextResponse.json({ error: 'Failed to load PDA funds-held report' }, { status: 500 })
  }
}
