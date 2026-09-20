import { google } from 'googleapis'
import { prisma } from '../prisma'
import { resolveTimezone, timezoneFromState } from '@/lib/utils/timezone'
import { addMinutes, parseISO } from 'date-fns'
import { signOAuthState } from '../oauth-state'

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
)

export class GoogleCalendarService {
  // Generate OAuth URL for instructor to connect
  getAuthUrl(providerId: string): string {
    const scopes = [
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/calendar.events.readonly',
      'https://www.googleapis.com/auth/calendar.events' // Add write permission
    ]

    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state: signOAuthState(providerId),
      prompt: 'consent' // Force consent to get refresh token
    })
  }

  // Exchange authorization code for tokens
  async getTokensFromCode(code: string) {
    const { tokens } = await oauth2Client.getToken(code)
    return tokens
  }

  // Save tokens to instructor record.
  //
  // INT-M-03F FIX — two distinct modes:
  //   enableSync=true  → OAuth callback: store credentials AND enable calendar sync
  //   enableSync=false → Token refresh:  update credentials ONLY; never touch syncGoogleCalendar
  //
  // This invariant prevents a background token refresh from silently re-enabling
  // calendar sync after an instructor has deliberately disconnected.
  //
  // Callers:
  //   1. OAuth callback (app/api/calendar/callback/route.ts) — enableSync=true  (explicit)
  //   2. getCalendarClient token-refresh path (below)         — enableSync=false (explicit)
  //
  // enableSync has NO default — every caller must state intent explicitly.
  // This prevents a future caller from accidentally re-enabling sync by omitting the flag.
  async saveTokens(providerId: string, tokens: any, enableSync: boolean) {
    const data: Record<string, any> = {
      googleAccessToken: tokens.access_token,
      googleTokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
    }
    // Only update refresh token when Google actually returns one (not undefined).
    // Google omits refresh_token on non-consent refreshes.
    if (tokens.refresh_token !== undefined) {
      data.googleRefreshToken = tokens.refresh_token
    }
    // Only the OAuth authorization callback should enable sync.
    // Token refreshes must not override the instructor's sync preference.
    if (enableSync) {
      data.syncGoogleCalendar = true
    }
    await prisma.provider.update({
      where: { id: providerId },
      data,
    })
  }

  // Get calendar client for instructor
  async getCalendarClient(providerId: string) {
    const instructor = await prisma.provider.findUnique({
      where: { id: providerId },
      select: {
        googleAccessToken: true,
        googleRefreshToken: true,
        googleTokenExpiry: true,
        googleCalendarId: true
      }
    })

    if (!instructor?.googleAccessToken || !instructor?.googleRefreshToken) {
      throw new Error('Google Calendar not connected')
    }

    oauth2Client.setCredentials({
      access_token: instructor.googleAccessToken,
      refresh_token: instructor.googleRefreshToken,
      expiry_date: instructor.googleTokenExpiry?.getTime()
    })

    // Refresh token if expired — pass enableSync=false so refresh never re-enables sync
    if (instructor.googleTokenExpiry && new Date() > instructor.googleTokenExpiry) {
      const { credentials } = await oauth2Client.refreshAccessToken()
      await this.saveTokens(providerId, credentials, false)
      oauth2Client.setCredentials(credentials)
    }

    return google.calendar({ version: 'v3', auth: oauth2Client })
  }

  // Sync calendar events and create availability exceptions
  async syncCalendarEvents(providerId: string) {
    try {
      const calendar = await this.getCalendarClient(providerId)
      
      const instructor = await prisma.provider.findUnique({
        where: { id: providerId },
        select: { 
          googleCalendarId: true
        }
      })

      // Get events for next 30 days
      const now = new Date()
      const thirtyDaysLater = new Date()
      thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30)

      const response = await calendar.events.list({
        calendarId: instructor?.googleCalendarId || 'primary',
        timeMin: now.toISOString(),
        timeMax: thirtyDaysLater.toISOString(),
        singleEvents: true,
        orderBy: 'startTime'
      })

      const events = response.data.items || []

      // Process each event
      for (const event of events) {
        // Only process events with specific start/end times (skip all-day events)
        if (!event.start?.dateTime || !event.end?.dateTime) continue

        const startTime = parseISO(event.start.dateTime)
        const endTime = parseISO(event.end.dateTime)

        // Check if it's a driving-related event (lesson or PDA test)
        const isDrivingEvent = this.isDrivingRelatedEvent(event.summary || '', event.description || '')
        
        // Skip non-driving events (personal reminders, appointments, etc.)
        if (!isDrivingEvent) continue

        // Check if it's a PDA test (look for keywords)
        const isPDATest = this.isPDATestEvent(event.summary || '', event.description || '')

        // If PDA test, block 2 hours before and 1 hour after
        const blockStart = isPDATest ? addMinutes(startTime, -120) : startTime
        const blockEnd = isPDATest ? addMinutes(endTime, 60) : endTime

        // Create availability exception
        try {
          await prisma.availabilityException.create({
            data: {
              providerId,
              exceptionDate: startTime,
              startTime: blockStart.toTimeString().slice(0, 5),
              endTime: blockEnd.toTimeString().slice(0, 5),
              reason: isPDATest ? 'pda_test' : 'google_calendar_event',
            }
          })
        } catch (error) {
          // If already exists, skip
          console.log('Exception may already exist, skipping...')
        }
      }

      return { success: true, eventsProcessed: events.length }
    } catch (error) {
      console.error('Calendar sync error:', error)
      throw error
    }
  }

  // Check if event is driving-related (should block booking slots)
  private isDrivingRelatedEvent(summary: string, description: string): boolean {
    const drivingKeywords = [
      'lesson',
      'driving',
      'pda',
      'test',
      'student',
      'customer',
      'pickup',
      'practice',
      'training',
      'instruction'
    ]

    const text = `${summary} ${description}`.toLowerCase()
    return drivingKeywords.some(keyword => text.includes(keyword))
  }

  // Check if event is a PDA test
  private isPDATestEvent(summary: string, description: string): boolean {
    const keywords = [
      'pda test',
      'driving test',
      'practical test',
      'assessment',
      'examination',
      'test center',
      'licensing center'
    ]

    const text = `${summary} ${description}`.toLowerCase()
    return keywords.some(keyword => text.includes(keyword))
  }

  // Disconnect Google Calendar
  //
  // INT-M-03F FIX:
  //   1. Read the current refresh token.
  //   2. Attempt Google OAuth revocation (revokeToken) so the credential is
  //      invalidated at Google's authorization server.
  //   3. Handle all Google API failure cases — revocation failure MUST NOT
  //      prevent local credential deletion (user's disconnect intent is honoured).
  //   4. Null all credential fields and disable sync locally.
  //   5. Never log or expose OAuth tokens.
  async disconnect(providerId: string) {
    // Step 1: Read the refresh token BEFORE clearing it
    const provider = await prisma.provider.findUnique({
      where: { id: providerId },
      select: { googleRefreshToken: true },
    })

    // Step 2: Attempt remote revocation
    if (provider?.googleRefreshToken) {
      try {
        oauth2Client.setCredentials({ refresh_token: provider.googleRefreshToken })
        await oauth2Client.revokeToken(provider.googleRefreshToken)
        // Revocation succeeded — credential is invalidated at Google
      } catch (revokeErr: any) {
        // Categorise the failure for audit logging without exposing the token
        const errMsg = revokeErr?.message ?? String(revokeErr)
        const isAlreadyInvalid =
          errMsg.includes('token_revoked') ||
          errMsg.includes('invalid_token') ||
          errMsg.includes('Token has been expired')

        if (isAlreadyInvalid) {
          // Token was already revoked or expired — local cleanup is still correct
          console.info('[GoogleCalendar] disconnect: token was already invalid at Google (proceeding with local cleanup)')
        } else {
          // Unexpected revocation failure — log for ops investigation (no token in log)
          console.error('[GoogleCalendar] disconnect: remote revocation failed (proceeding with local cleanup)', {
            providerId,
            error: errMsg,
          })
          // Best-effort alert — non-blocking; does not prevent local disconnect
          try {
            const { sendAlert } = await import('@/lib/services/alert-service')
            void sendAlert({
              type: 'RECONCILIATION_ISSUES',
              severity: 'WARNING',
              message: `Google Calendar OAuth revocation failed for provider ${providerId}. Local credentials have been cleared. The previously issued refresh token may remain valid at Google until it expires naturally. Manual revocation via Google Account settings may be required.`,
              entityId: providerId,
              metadata: { providerId, error: errMsg, action: 'google_oauth_revocation_failed' },
            })
          } catch {
            // Alert failure is non-fatal
          }
        }
        // Fall through to local cleanup regardless of revocation outcome
      }
    }

    // Step 3: Clear all local credentials — always executes regardless of revocation result
    await prisma.provider.update({
      where: { id: providerId },
      data: {
        googleAccessToken: null,
        googleRefreshToken: null,
        googleTokenExpiry: null,
        googleCalendarId: null,
        syncGoogleCalendar: false,
      },
    })

    // Step 4: Delete calendar-derived availability exceptions
    await prisma.availabilityException.deleteMany({
      where: {
        providerId,
        reason: 'google_calendar_event',
      },
    })
  }

  // Push booking to Google Calendar
  async createCalendarEvent(providerId: string, booking: {
    id: string
    startTime: Date
    endTime: Date
    customerName: string
    customerPhone: string
    pickupAddress?: string
    notes?: string
  }) {
    try {
      const calendar = await this.getCalendarClient(providerId)
      
      const instructor = await prisma.provider.findUnique({
        where: { id: providerId },
        select: { googleCalendarId: true }
      })

      const instr = await prisma.provider.findUnique({ where: { id: providerId }, select: { timezone: true, state: true } })
      const tz = resolveTimezone(instr?.timezone ?? timezoneFromState(instr?.state))

      const event = {
        summary: `Booking - ${booking.customerName}`,
        description: `Client: ${booking.customerName}\nPhone: ${booking.customerPhone}\nPickup: ${booking.pickupAddress || 'N/A'}\nNotes: ${booking.notes || 'N/A'}\n\nBooking ID: ${booking.id}`,
        start: {
          dateTime: booking.startTime.toISOString(),
          timeZone: tz
        },
        end: {
          dateTime: booking.endTime.toISOString(),
          timeZone: tz
        },
        location: booking.pickupAddress,
        colorId: '9' // Blue color for lessons
      }

      const response = await calendar.events.insert({
        calendarId: instructor?.googleCalendarId || 'primary',
        requestBody: event
      })

      return { success: true, eventId: response.data.id }
    } catch (error) {
      console.error('Create calendar event error:', error)
      throw error
    }
  }

  // Update calendar event
  async updateCalendarEvent(providerId: string, eventId: string, booking: {
    startTime: Date
    endTime: Date
    customerName: string
    customerPhone: string
    pickupAddress?: string
    notes?: string
  }) {
    try {
      const calendar = await this.getCalendarClient(providerId)
      
      const instructor = await prisma.provider.findUnique({
        where: { id: providerId },
        select: { googleCalendarId: true }
      })

      const instr2 = await prisma.provider.findUnique({ where: { id: providerId }, select: { timezone: true, state: true } })
      const tz2 = resolveTimezone(instr2?.timezone ?? timezoneFromState(instr2?.state))

      const event = {
        summary: `Booking - ${booking.customerName}`,
        description: `Client: ${booking.customerName}\nPhone: ${booking.customerPhone}\nPickup: ${booking.pickupAddress || 'N/A'}\nNotes: ${booking.notes || 'N/A'}`,
        start: {
          dateTime: booking.startTime.toISOString(),
          timeZone: tz2
        },
        end: {
          dateTime: booking.endTime.toISOString(),
          timeZone: tz2
        },
        location: booking.pickupAddress
      }

      await calendar.events.update({
        calendarId: instructor?.googleCalendarId || 'primary',
        eventId: eventId,
        requestBody: event
      })

      return { success: true }
    } catch (error) {
      console.error('Update calendar event error:', error)
      throw error
    }
  }

  // Delete calendar event
  async deleteCalendarEvent(providerId: string, eventId: string) {
    try {
      const calendar = await this.getCalendarClient(providerId)
      
      const instructor = await prisma.provider.findUnique({
        where: { id: providerId },
        select: { googleCalendarId: true }
      })

      await calendar.events.delete({
        calendarId: instructor?.googleCalendarId || 'primary',
        eventId: eventId
      })

      return { success: true }
    } catch (error) {
      console.error('Delete calendar event error:', error)
      throw error
    }
  }
}

export const googleCalendarService = new GoogleCalendarService()
