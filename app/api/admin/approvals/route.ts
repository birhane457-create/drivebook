/**
 * Admin API: Approval Workflow
 * View and manage pending approvals for high-value actions
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ApprovalWorkflowService } from '@/lib/services/approval-workflow'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/approvals
 * List pending approvals
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const actionType = searchParams.get('actionType') as any
    const requestedBy = searchParams.get('requestedBy') || undefined
    const limit = parseInt(searchParams.get('limit') || '50')

    const approvals = await ApprovalWorkflowService.getPendingApprovals({
      actionType,
      requestedBy,
      limit,
    })

    return NextResponse.json({
      approvals,
      total: approvals.length,
    })
  } catch (error) {
    console.error('Failed to fetch approvals:', error)
    return NextResponse.json(
      { error: 'Failed to fetch approvals' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/approvals/[id]/approve
 * Approve or reject a pending request
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { approvalId, approved, reason } = body

    if (!approvalId || typeof approved !== 'boolean') {
      return NextResponse.json(
        { error: 'Missing required fields: approvalId, approved' },
        { status: 400 }
      )
    }

    const result = await ApprovalWorkflowService.approve({
      approvalId,
      decidedBy: session!.user.id,
      decidedByName: (session!.user as any).name || undefined,
      decidedByEmail: session!.user.email || undefined,
      approved,
      reason,
    })

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Failed to process approval:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to process approval' },
      { status: 400 }
    )
  }
}
