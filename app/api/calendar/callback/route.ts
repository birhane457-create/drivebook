import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { googleCalendarService } from '@/lib/services/googleCalendar'
import { verifyOAuthState } from '@/lib/oauth-state'
import { getAppUrl } from '@/lib/utils/appUrl'

export const dynamic = 'force-dynamic'

// PH4-CAL-01 FIX: Use getAppUrl() which prioritises NEXT_PUBLIC_APP_URL.
// The previous appUrl() helper used NEXTAUTH_URL which may be http://localhost:3000
// in production if NEXT_PUBLIC_APP_URL is not set in Vercel.
function oauthRedirectUrl(path: string): string {
  return `${getAppUrl().replace(/\/$/, '')}${path}`
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    if (error) {
      return NextResponse.redirect(oauthRedirectUrl(`/dashboard/settings?error=${error}`))
    }

    if (!code || !state) {
      return NextResponse.redirect(oauthRedirectUrl('/dashboard/settings?error=missing_params'))
    }

    const verified = verifyOAuthState(state)
    if (!verified) {
      return NextResponse.redirect(oauthRedirectUrl('/dashboard/settings?error=invalid_state'))
    }

    const session = await getServerSession(authOptions)
    if (session?.user?.providerId && session!.user!.providerId !== verified.providerId) {
      return NextResponse.redirect(oauthRedirectUrl('/dashboard/settings?error=session_mismatch'))
    }

    const providerId = verified.providerId
    const tokens = await googleCalendarService.getTokensFromCode(code)
    await googleCalendarService.saveTokens(providerId, tokens, true)
    await googleCalendarService.syncCalendarEvents(providerId)

    return NextResponse.redirect(oauthRedirectUrl('/dashboard/settings?success=calendar_connected'))
  } catch (error) {
    console.error('Google OAuth callback error:', error)
    return NextResponse.redirect(oauthRedirectUrl('/dashboard/settings?error=auth_failed'))
  }
}
