import { NextRequest, NextResponse } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  requirePermission: vi.fn(),
  checkRateLimitStrict: vi.fn(),
  fetch: vi.fn(),
  callTool: vi.fn(),
  validateToolArguments: vi.fn(),
  auditCreate: vi.fn(),
}))

vi.mock('next-auth', () => ({ getServerSession: mocks.getServerSession }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/auth/requireRole', () => ({ requirePermission: mocks.requirePermission }))
vi.mock('@/lib/rbac/permissions', () => ({ PERM: { PLATFORM_COPILOT_VIEW: 'platform_copilot_view' } }))
vi.mock('@/lib/ratelimit', () => ({ checkRateLimitStrict: mocks.checkRateLimitStrict, adminActionRateLimit: {} }))
vi.mock('@/lib/prisma', () => ({ prisma: { auditLog: { create: mocks.auditCreate } } }))
vi.mock('@/lib/admin/ai-tools', () => ({ TOOL_DEFINITIONS: [], callTool: mocks.callTool, validateToolArguments: mocks.validateToolArguments }))

import { POST } from '@/app/api/admin/ai-query/route'

const denials = [
  ['anonymous session', null],
  ['client role', { user: { id: 'client-1', email: 'client@example.test', role: 'CLIENT' } }],
  ['provider role', { user: { id: 'provider-1', email: 'provider@example.test', role: 'PROVIDER' } }],
  ['staff without Copilot permission', { user: { id: 'staff-1', email: 'staff@example.test', role: 'STAFF' } }],
  ['expired session', { user: { id: 'expired-1', email: 'expired@example.test' } }],
  ['missing user id', { user: { email: 'missing-id@example.test' } }],
  ['missing email', { user: { id: 'missing-email' } }],
  ['empty session', {}],
  ['suspended admin', { user: { id: 'suspended-1', email: 'suspended@example.test', role: 'ADMIN' } }],
  ['unapproved provider', { user: { id: 'unapproved-1', email: 'unapproved@example.test', role: 'PROVIDER' } }],
] as const

function request() {
  return new NextRequest('http://localhost/api/admin/ai-query', {
    method: 'POST',
    body: JSON.stringify({ messages: [{ role: 'user', content: 'Show me platform activity' }] }),
    headers: { 'content-type': 'application/json' },
  })
}

describe('P1-10 permission boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.OPENAI_API_KEY
    delete process.env.ANTHROPIC_API_KEY
    mocks.checkRateLimitStrict.mockResolvedValue({ success: true })
    mocks.auditCreate.mockResolvedValue({})
    mocks.requirePermission.mockResolvedValue(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
  })

  it.each(denials)('%s is denied before provider request or tool dispatch', async (_case, session) => {
    mocks.getServerSession.mockResolvedValue(session)
    const result = await POST(request())
    expect(result.status).toBe(403)
    expect(mocks.fetch).not.toHaveBeenCalled()
    expect(mocks.callTool).not.toHaveBeenCalled()
  })
})
