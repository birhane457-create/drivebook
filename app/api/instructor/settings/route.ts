import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'


export const dynamic = 'force-dynamic';
const settingsSchema = z.object({
  hourlyRate: z.number().positive().optional(),
  serviceRadiusKm: z.number().min(5).max(100).optional(),
  vehicleTypes: z.array(z.enum(['AUTO', 'MANUAL'])).optional(),
  workingHours: z.record(z.array(z.object({
    start: z.string(),
    end: z.string()
  }))).optional(),
  licenseNumber: z.string().optional(),
  insuranceNumber: z.string().optional(),
  // New booking slot configuration fields
  allowedDurations: z.array(z.number().min(30).max(120)).min(1).optional(),
  bookingBufferMinutes: z.number().min(10).max(20).optional(),
  enableTravelTime: z.boolean().optional(),
  travelTimeMinutes: z.number().min(5).max(60).optional()
})

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.instructorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const data = settingsSchema.parse(body)

    // Build update object with only provided fields
    const updateData: any = {}
    if (data.hourlyRate !== undefined) updateData.hourlyRate = data.hourlyRate
    if (data.serviceRadiusKm !== undefined) updateData.serviceRadiusKm = data.serviceRadiusKm
    if (data.vehicleTypes !== undefined) updateData.vehicleTypes = data.vehicleTypes
    if (data.workingHours !== undefined) updateData.workingHours = data.workingHours
    if (data.licenseNumber !== undefined) updateData.licenseNumber = data.licenseNumber
    if (data.insuranceNumber !== undefined) updateData.insuranceNumber = data.insuranceNumber
    if (data.allowedDurations !== undefined) updateData.allowedDurations = data.allowedDurations
    if (data.bookingBufferMinutes !== undefined) updateData.bookingBufferMinutes = data.bookingBufferMinutes
    if (data.enableTravelTime !== undefined) updateData.enableTravelTime = data.enableTravelTime
    if (data.travelTimeMinutes !== undefined) updateData.travelTimeMinutes = data.travelTimeMinutes

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
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    console.error('Settings update error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
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
        vehicleTypes: true,
        workingHours: true,
        licenseNumber: true,
        insuranceNumber: true,
        allowedDurations: true,
        bookingBufferMinutes: true,
        enableTravelTime: true,
        travelTimeMinutes: true
      }
    } as any) // Temporary type assertion

    return NextResponse.json(instructor)
  } catch (error) {
    console.error('Fetch settings error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
