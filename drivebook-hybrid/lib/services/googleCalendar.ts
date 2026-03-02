import { google } from 'googleapis'
import { prisma } from '../prisma'
import { addMinutes, parseISO } from 'date-fns'

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
)

export class GoogleCalendarService {
  // Generate OAuth URL for instructor to connect
  getAuthUrl(instructorId: string): string {
    const scopes = [
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/calendar.events.readonly',
      'https://www.googleapis.com/auth/calendar.events' // Add write permission
    ]

    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state: instructorId, // Pass instructor ID to callback
      prompt: 'consent' // Force consent to get refresh token
    })
  }

  // Exchange authorization code for tokens
  async getTokensFromCode(code: string) {
    const { tokens } = await oauth2Client.getToken(code)
    return tokens
  }

  // Save tokens to instructor record
  async saveTokens(instructorId: string, tokens: any) {
    await prisma.instructor.update({
      where: { id: instructorId },
      data: {
        googleAccessToken: tokens.access_token,
        googleRefreshToken: tokens.refresh_token,
        googleTokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        syncGoogleCalendar: true
      }
    })
  }

  // Get calendar client for instructor
  async getCalendarClient(instructorId: string) {
    const instructor = await prisma.instructor.findUnique({
      where: { id: instructorId },
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

    // Refresh token if expired
    if (instructor.googleTokenExpiry && new Date() > instructor.googleTokenExpiry) {
      const { credentials } = await oauth2Client.refreshAccessToken()
      await this.saveTokens(instructorId, credentials)
      oauth2Client.setCredentials(credentials)
    }

    return google.calendar({ version: 'v3', auth: oauth2Client })
  }

  // Sync calendar events and create availability exceptions
  async syncCalendarEvents(instructorId: string) {
    try {
      const calendar = await this.getCalendarClient(instructorId)
      
      const instructor = await prisma.instructor.findUnique({
        where: { id: instructorId },
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
              instructorId,
              exceptionDate: startTime,
              startTime: blockStart.toTimeString().slice(0, 5),
              endTime: blockEnd.toTimeString().slice(0, 5),
              reason: isPDATest ? 'pda_test' : 'google_calendar_event',
              isRecurring: false
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
      'client',
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
  async disconnect(instructorId: string) {
    await prisma.instructor.update({
      where: { id: instructorId },
      data: {
        googleAccessToken: null,
        googleRefreshToken: null,
        googleTokenExpiry: null,
        googleCalendarId: null,
        syncGoogleCalendar: false
      }
    })

    // Optionally delete all google calendar exceptions
    await prisma.availabilityException.deleteMany({
      where: {
        instructorId,
        reason: 'google_calendar_event'
      }
    })
  }

  // Push booking to Google Calendar
  async createCalendarEvent(instructorId: string, booking: {
    id: string
    startTime: Date
    endTime: Date
    clientName: string
    clientPhone: string
    pickupAddress?: string
    notes?: string
  }) {
    try {
      const calendar = await this.getCalendarClient(instructorId)
      
      const instructor = await prisma.instructor.findUnique({
        where: { id: instructorId },
        select: { googleCalendarId: true }
      })

      const event = {
        summary: `Driving Lesson - ${booking.clientName}`,
        description: `Client: ${booking.clientName}\nPhone: ${booking.clientPhone}\nPickup: ${booking.pickupAddress || 'N/A'}\nNotes: ${booking.notes || 'N/A'}\n\nBooking ID: ${booking.id}`,
        start: {
          dateTime: booking.startTime.toISOString(),
          timeZone: 'Australia/Perth'
        },
        end: {
          dateTime: booking.endTime.toISOString(),
          timeZone: 'Australia/Perth'
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
  async updateCalendarEvent(instructorId: string, eventId: string, booking: {
    startTime: Date
    endTime: Date
    clientName: string
    clientPhone: string
    pickupAddress?: string
    notes?: string
  }) {
    try {
      const calendar = await this.getCalendarClient(instructorId)
      
      const instructor = await prisma.instructor.findUnique({
        where: { id: instructorId },
        select: { googleCalendarId: true }
      })

      const event = {
        summary: `Driving Lesson - ${booking.clientName}`,
        description: `Client: ${booking.clientName}\nPhone: ${booking.clientPhone}\nPickup: ${booking.pickupAddress || 'N/A'}\nNotes: ${booking.notes || 'N/A'}`,
        start: {
          dateTime: booking.startTime.toISOString(),
          timeZone: 'Australia/Perth'
        },
        end: {
          dateTime: booking.endTime.toISOString(),
          timeZone: 'Australia/Perth'
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
  async deleteCalendarEvent(instructorId: string, eventId: string) {
    try {
      const calendar = await this.getCalendarClient(instructorId)
      
      const instructor = await prisma.instructor.findUnique({
        where: { id: instructorId },
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
