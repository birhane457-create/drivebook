import { NextRequest, NextResponse } from 'next/server'
import { googleCalendarService } from '@/lib/services/googleCalendar'

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

    const instructorId = state

    // Exchange code for tokens
    const tokens = await googleCalendarService.getTokensFromCode(code)
    await googleCalendarService.saveTokens(instructorId, tokens)
    
    // Sync calendar events
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
