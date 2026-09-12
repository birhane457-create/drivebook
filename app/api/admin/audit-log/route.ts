/**
 * GET /api/admin/audit-log
 *
 * Cursor-based paginated audit log with filtering.
 *
 * Query params:
 *   targetType  — PAYOUT | TRANSACTION | INSTRUCTOR | BOOKING
 *   action      — exact action string (e.g. PAYOUT_PAID)
 *   actorId     — filter by admin user ID
 *   from        — ISO date string (inclusive)
 *   to          — ISO date string (inclusive)
 *   limit       — default 50, max 100
 *   cursor      — last log ID from previous page (for next page)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

import { requirePermission } from '@/lib/auth/requireRole';
import { PERM } from '@/lib/rbac/permissions';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const deny = await requirePermission(session, PERM.OPERATIONS_AUDIT_LOG_VIEW);
  if (deny) return deny;

  const { searchParams } = req.nextUrl;
  const targetType = searchParams.get('targetType') ?? undefined;
  const action     = searchParams.get('action') ?? undefined;
  const actorId    = searchParams.get('actorId') ?? undefined;
  const from       = searchParams.get('from') ?? undefined;
  const to         = searchParams.get('to') ?? undefined;
  const cursor     = searchParams.get('cursor') ?? undefined;
  const limit      = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 100);

  const where: Record<string, unknown> = {};
  if (targetType) where.targetType = targetType;
  if (action)     where.action = action;
  if (actorId)    where.actorId = actorId;
  if (from || to) {
    where.createdAt = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to   ? { lte: new Date(to)   } : {}),
    };
  }

  // Cursor pagination — fetch limit+1 to detect if there's a next page
  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
  });

  const hasMore = logs.length > limit;
  const page = hasMore ? logs.slice(0, limit) : logs;
  const nextCursor = hasMore ? page[page.length - 1].id : undefined;

  return NextResponse.json({ logs: page, nextCursor });
}
