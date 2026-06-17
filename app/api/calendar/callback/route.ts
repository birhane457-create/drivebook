import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { googleCalendarService } from '@/lib/services/googleCalendar'
import { verifyOAuthState } from '@/lib/oauth-state'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    if (error) {
      return NextResponse.redirect(
        new URL(`/dashboard/settings?error=${error}`, req.url)
      )
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL('/dashboard/settings?error=missing_params', req.url)
      )
    }

    const verified = verifyOAuthState(state)
    if (!verified) {
      return NextResponse.redirect(
        new URL('/dashboard/settings?error=invalid_state', req.url)
      )
    }

    const session = await getServerSession(authOptions)
    if (session?.user?.instructorId && session.user.instructorId !== verified.instructorId) {
      return NextResponse.redirect(
        new URL('/dashboard/settings?error=session_mismatch', req.url)
      )
    }

    const instructorId = verified.instructorId
    const tokens = await googleCalendarService.getTokensFromCode(code)
    await googleCalendarService.saveTokens(instructorId, tokens)
    await googleCalendarService.syncCalendarEvents(instructorId)

    return NextResponse.redirect(
      new URL('/dashboard/settings?success=calendar_connected', req.url)
    )
  } catch (error) {
    console.error('Google OAuth callback error:', error)
    return NextResponse.redirect(
      new URL('/dashboard/settings?error=auth_failed', req.url)
    )
  }
}
