import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    return NextResponse.json({
      hasSession: !!session,
      session: session ? {
        user: session.user,
        expires: session.expires,
      } : null,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json({
      error: String(error),
      hasSession: false,
    }, { status: 500 })
  }
}
