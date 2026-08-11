import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

import { requirePermission } from '@/lib/auth/requireRole';
import { PERM } from '@/lib/rbac/permissions';
export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/ai-brief/history
 *
 * Returns paginated AI brief history from the AdminBrief table.
 *
 * Query params:
 *   page    number  page number, 1-indexed (default 1)
 *   limit   number  records per page (default 14, max 30)
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const limit = Math.min(30, Math.max(1, parseInt(searchParams.get('limit') ?? '14', 10)))
  const skip = (page - 1) * limit

  const [briefs, total] = await Promise.all([
    (prisma as any).adminBrief.findMany({
      orderBy: { date: 'desc' },
      skip,
      take: limit,
      select: {
        id: true,
        date: true,
        brief: true,
        model: true,
        tokens: true,
        healthScore: true,
        createdAt: true,
        generatedBy: true,
      },
    }),
    (prisma as any).adminBrief.count(),
  ])

  return NextResponse.json({
    briefs,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasMore: skip + limit < total,
    },
  })
}
