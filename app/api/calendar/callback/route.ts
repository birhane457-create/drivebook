import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { googleCalendarService } from '@/lib/services/googleCalendar'
import { verifyOAuthState } from '@/lib/oauth-state'

export const dynamic = 'force-dynamic'

/**
 * Use NEXTAUTH_URL as the redirect base.
 * req.url can be http://0.0.0.0:3000/... in dev (Next.js internal bind address)
 * which browsers cannot resolve. NEXTAUTH_URL is always the correct public origin.
 */
function appUrl(path: string): string {
  const base = (process.env.NEXTAUTH_URL || 'http://localhost:3000').replace(/\/$/, '')
  return `${base}${path}`
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    if (error) {
      return NextResponse.redirect(appUrl(`/dashboard/settings?error=${error}`))
    }

    if (!code || !state) {
      return NextResponse.redirect(appUrl('/dashboard/settings?error=missing_params'))
    }

    const verified = verifyOAuthState(state)
    if (!verified) {
      return NextResponse.redirect(appUrl('/dashboard/settings?error=invalid_state'))
    }

    const session = await getServerSession(authOptions)
    if (session?.user?.instructorId && session.user.instructorId !== verified.instructorId) {
      return NextResponse.redirect(appUrl('/dashboard/settings?error=session_mismatch'))
    }

    const instructorId = verified.instructorId
    const tokens = await googleCalendarService.getTokensFromCode(code)
    await googleCalendarService.saveTokens(instructorId, tokens)
    await googleCalendarService.syncCalendarEvents(instructorId)

    return NextResponse.redirect(appUrl('/dashboard/settings?success=calendar_connected'))
  } catch (error) {
    console.error('Google OAuth callback error:', error)
    return NextResponse.redirect(appUrl('/dashboard/settings?error=auth_failed'))
  }
}
