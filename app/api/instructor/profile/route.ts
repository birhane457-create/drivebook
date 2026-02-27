import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const profileSchema = z.object({
  name: z.string(),
  phone: z.string(),
  bio: z.string().optional(),
  profileImage: z.string().optional(),
  carImage: z.string().optional(),
  carMake: z.string().optional(),
  carModel: z.string().optional(),
  carYear: z.number().optional().nullable(),
})

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.instructorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const instructor = await prisma.instructor.findUnique({
      where: { id: session.user.instructorId },
      select: {
        id: true,
        name: true,
        phone: true,
        bio: true,
        profileImage: true,
        carImage: true,
        carMake: true,
        carModel: true,
        carYear: true,
        hourlyRate: true,
        vehicleTypes: true,
        serviceRadiusKm: true,
        baseAddress: true,
        licenseNumber: true,
        insuranceNumber: true,
        languages: true,
        isActive: true,
        isVerified: true,
      }
    } as any) // Temporary: Remove after running 'npx prisma generate'

    return NextResponse.json(instructor)
  } catch (error) {
    console.error('Fetch profile error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.instructorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const data = profileSchema.parse(body)

    const instructor = await prisma.instructor.update({
      where: { id: session.user.instructorId },
      data: {
        name: data.name,
        phone: data.phone,
        bio: data.bio,
        profileImage: data.profileImage,
        carImage: data.carImage,
        carMake: data.carMake,
        carModel: data.carModel,
        carYear: data.carYear,
      }
    })

    return NextResponse.json(instructor)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    console.error('Update profile error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
