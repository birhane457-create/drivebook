import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { requireActiveSubscription } from '@/lib/middleware/subscriptionValidation'


export const dynamic = 'force-dynamic';
const settingsSchema = z.object({
  hourlyRate: z.number().positive().optional(),
  serviceRadiusKm: z.number().min(1).max(100).optional(),
  baseAddress: z.string().optional().nullable(),
  // serviceAreas: JSON-encoded array of "Suburb|STATE|postcode" tokens
  // e.g. '["Maylands|WA|6051","Bayswater|WA|6053"]'
  // Suburb-first search uses this list; radius is the fallback for instructors who haven't set it.
  serviceAreas: z.string().optional().nullable(),
  timezone: z.string().optional().nullable(),
  vehicleTypes: z.union([
    z.array(z.enum(['AUTO', 'MANUAL'])),
    z.enum(['AUTO', 'MANUAL']).transform(v => [v]),
  ]).optional(),
  workingHours: z.object({
    monday:    z.array(z.object({ start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Must be HH:MM'), end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Must be HH:MM') })).optional(),
    tuesday:   z.array(z.object({ start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Must be HH:MM'), end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Must be HH:MM') })).optional(),
    wednesday: z.array(z.object({ start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Must be HH:MM'), end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Must be HH:MM') })).optional(),
    thursday:  z.array(z.object({ start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Must be HH:MM'), end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Must be HH:MM') })).optional(),
    friday:    z.array(z.object({ start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Must be HH:MM'), end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Must be HH:MM') })).optional(),
    saturday:  z.array(z.object({ start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Must be HH:MM'), end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Must be HH:MM') })).optional(),
    sunday:    z.array(z.object({ start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Must be HH:MM'), end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Must be HH:MM') })).optional(),
  }).optional(),
  licenseNumber: z.string().optional(),
  insuranceNumber: z.string().optional(),
  // New booking slot configuration fields
  allowedDurations: z.array(z.number().min(30).max(180)).min(1).optional(),
  bookingBufferMinutes: z.number().min(10).max(20).optional(),
  enableTravelTime: z.boolean().optional(),
  travelTimeMinutes: z.number().min(5).max(60).optional(),
  // PDA configs - handled separately, ignored here
  pdaConfigs: z.array(z.any()).optional(),
  // FIX #14: Self-service booking pause toggle
  acceptingBookings: z.boolean().optional(),
})

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.instructorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Read-only guard — inactive instructors can view but not change settings
    const subCheck = await requireActiveSubscription(session.user.id)
    if (!subCheck.valid) {
      return NextResponse.json({ error: subCheck.message, requiresSubscription: true }, { status: 403 })
    }

    const body = await req.json()
    
    // Validate the data
    const validationResult = settingsSchema.safeParse(body)
    
    if (!validationResult.success) {
      console.error('Settings validation failed:', validationResult.error.errors)
      const errorDetails = validationResult.error.errors?.map(e => `${e.path.join('.')}: ${e.message}`).join(', ') || 'Invalid data format'
      return NextResponse.json({ 
        error: 'Validation failed',
        details: errorDetails,
        fields: validationResult.error.errors || []
      }, { status: 400 })
    }
    
    const data = validationResult.data

    // Build update object with only provided fields
    const updateData: any = {}
    if (data.hourlyRate !== undefined) updateData.hourlyRate = data.hourlyRate
    if (data.serviceRadiusKm !== undefined) updateData.serviceRadiusKm = data.serviceRadiusKm
    if (data.serviceAreas !== undefined) updateData.serviceAreas = data.serviceAreas ?? null
    if (data.timezone !== undefined) updateData.timezone = data.timezone ?? null
    if (data.baseAddress !== undefined) {
      updateData.baseAddress = data.baseAddress || null
      // Extract discrete location fields from the address string for SEO location pages
      // and populate lat/lng from the postcode lookup (no external geocoding needed)
      if (data.baseAddress) {
        const { parseAuAddress } = await import('@/lib/data/au-locations')
        const parsed = parseAuAddress(data.baseAddress)
        if (parsed.state)    updateData.state    = parsed.state
        if (parsed.suburb)   updateData.suburb   = parsed.suburb
        if (parsed.postcode) updateData.postcode = parsed.postcode
        // Populate lat/lng from postcode lookup — instant, no API call
        if (parsed.lat !== null)  { updateData.baseLatitude  = parsed.lat; updateData.baseAddressLat = parsed.lat }
        if (parsed.lng !== null)  { updateData.baseLongitude = parsed.lng; updateData.baseAddressLng = parsed.lng }
      }
    }
    if (data.vehicleTypes !== undefined) updateData.vehicleTypes = Array.isArray(data.vehicleTypes) ? data.vehicleTypes.join(',') : data.vehicleTypes
    if (data.workingHours !== undefined) updateData.workingHours = data.workingHours
    if (data.licenseNumber !== undefined) updateData.licenseNumber = data.licenseNumber
    if (data.insuranceNumber !== undefined) updateData.insuranceNumber = data.insuranceNumber
    if (data.allowedDurations !== undefined) updateData.allowedDurations = data.allowedDurations
    if (data.bookingBufferMinutes !== undefined) updateData.bookingBufferMinutes = data.bookingBufferMinutes
    if (data.enableTravelTime !== undefined) updateData.enableTravelTime = data.enableTravelTime
    if (data.travelTimeMinutes !== undefined) updateData.travelTimeMinutes = data.travelTimeMinutes
    // Note: pdaConfigs are managed separately via /api/instructor/custom-packages
    // FIX #14: Allow instructors to pause/resume new bookings self-service
    if (data.acceptingBookings !== undefined) updateData.acceptingBookings = data.acceptingBookings

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    const instructor = await prisma.instructor.update({
      where: { id: session.user.instructorId },
      data: updateData
    })

    return NextResponse.json(instructor)
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Settings validation error:', error.errors)
      return NextResponse.json({ 
        error: 'Validation failed',
        details: error.errors?.map(e => `${e.path.join('.')}: ${e.message}`).join(', ') || 'Invalid data',
        fields: error.errors 
      }, { status: 400 })
    }
    
    // Log the actual error for debugging
    console.error('Settings update error:', error)
    console.error('Error type:', typeof error)
    console.error('Error constructor:', error?.constructor?.name)
    
    // Check if it's a Prisma error
    if (error && typeof error === 'object' && 'code' in error) {
      const prismaError = error as any
      return NextResponse.json({ 
        error: 'Database error',
        details: prismaError.message || 'Failed to update settings',
        code: prismaError.code
      }, { status: 400 })
    }
    
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.instructorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const instructor = await prisma.instructor.findUnique({
      where: { id: session.user.instructorId },
      select: {
        hourlyRate: true,
        serviceRadiusKm: true,
        baseAddress: true,
        serviceAreas: true,
        vehicleTypes: true,
        timezone: true,
        state: true,
        workingHours: true,
        // Credentials are managed from the Settings page — must be returned here
        // so the form pre-fills correctly. They are not exposed to other callers
        // via this route (settings is instructor-only, session-scoped).
        licenseNumber: true,
        insuranceNumber: true,
        allowedDurations: true,
        bookingBufferMinutes: true,
        enableTravelTime: true,
        travelTimeMinutes: true,
        acceptingBookings: true,
      }
    })

    // Return response
    const response = {
      ...instructor,
      pdaConfigs: [],  // Will be fetched separately via /api/instructor/custom-packages
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Fetch settings error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
