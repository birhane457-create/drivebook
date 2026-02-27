import { NextRequest, NextResponse } from 'next/server'
import { googleCalendarService } from '@/lib/services/googleCalendar'

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state') // instructor ID
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

    // Calendar sync only
    const instructorId = state
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
