import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockPrisma = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  staffMember: { findUnique: vi.fn() },
}))

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))

import { checkPermission } from '@/lib/rbac/checkPermission'
import { PERM } from '@/lib/rbac/permissions'

const ADMIN = { id: 'admin-1', role: 'ADMIN' }
const SUPER_ADMIN = { id: 'super-admin-1', role: 'SUPER_ADMIN' }
const STAFF = { id: 'staff-1', permissions: [PERM.PLATFORM_COPILOT_VIEW], maxRefundAmount: 500 }

const cases = [
  ['anonymous session', null, null, null, 'unauthenticated'],
  ['session without user id', { user: {} }, null, null, 'unauthenticated'],
  ['client role', { user: { id: 'client-1' } }, { id: 'client-1', role: 'CLIENT' }, null, 'not_admin'],
  ['provider role', { user: { id: 'provider-1' } }, { id: 'provider-1', role: 'provider' }, null, 'not_admin'],
  ['deleted admin user', { user: { id: 'deleted-1' } }, null, null, 'not_admin'],
  ['admin without staff record', { user: { id: ADMIN.id } }, ADMIN, null, 'no_staff_record'],
  ['admin missing Copilot permission', { user: { id: ADMIN.id } }, ADMIN, { ...STAFF, permissions: [] }, 'missing_permission'],
  ['admin with unrelated permission', { user: { id: ADMIN.id } }, ADMIN, { ...STAFF, permissions: ['platform.dashboard.view'] }, 'missing_permission'],
  ['admin with Copilot permission', { user: { id: ADMIN.id } }, ADMIN, STAFF, null],
  ['super admin wildcard', { user: { id: SUPER_ADMIN.id } }, SUPER_ADMIN, null, null],
] as const

describe('P1-10 permission boundary matrix', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it.each(cases)('%s evaluates the real permission function', async (_case, session, user, staff, expectedReason) => {
    mockPrisma.user.findUnique.mockResolvedValue(user)
    mockPrisma.staffMember.findUnique.mockResolvedValue(staff)

    const result = await checkPermission(session as any, PERM.PLATFORM_COPILOT_VIEW)

    if (expectedReason) {
      expect(result.allowed).toBe(false)
      if (result.allowed) return
      expect(result.reason).toBe(expectedReason)
      expect(result.response.status).toBe(expectedReason === 'unauthenticated' ? 401 : 403)
    } else {
      expect(result.allowed).toBe(true)
    }
  })
})
