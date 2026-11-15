import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    // Require authentication — this endpoint reveals session field structure.
    // Unauthenticated callers receive only hasSession: false (no session data),
    // but the endpoint should not be reachable without a valid session in production.
    if (!session) {
      return NextResponse.json({ hasSession: false }, { status: 401 })
    }

    return NextResponse.json({
      hasSession: true,
      session: {
        user: session.user,
        expires: session.expires,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json({
      error: String(error),
      hasSession: false,
    }, { status: 500 })
  }
}
