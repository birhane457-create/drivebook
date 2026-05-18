import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { requireActiveSubscription } from '@/lib/middleware/subscriptionValidation'

export const dynamic = 'force-dynamic';

const profileSchema = z.object({
  name: z.string(),
  phone: z.string(),
  bio: z.string().optional(),
  profileImage: z.string().optional(),
  carImage: z.string().optional(),
  carMake: z.string().optional(),
  carModel: z.string().optional(),
  carYear: z.number().optional().nullable(),
  whatsapp: z.string().optional().nullable(),
  instagram: z.string().optional().nullable(),
  facebook: z.string().optional().nullable(),
  yearsExperience: z.number().optional().nullable(),
  baseAddress: z.string().optional().nullable(),
  licenseNumber: z.string().optional().nullable(),
  insuranceNumber: z.string().optional().nullable(),
  languages: z.array(z.string()).optional(),
})

// Helper: find instructor by session (handles null instructorId via userId fallback)
async function getInstructorFromSession(session: any) {
  if (!session?.user) return null
  if (session.user.instructorId) {
    return prisma.instructor.findUnique({ where: { id: session.user.instructorId }, select: { id: true } })
  }
  // Fallback for SUPER_ADMIN / ADMIN accounts where instructorId isn't in the JWT
  return prisma.instructor.findFirst({ where: { userId: session.user.id }, select: { id: true } })
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const ref = await getInstructorFromSession(session)
    if (!ref) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const instructor = await prisma.instructor.findUnique({
      where: { id: ref.id },
      select: {
        id: true, name: true, phone: true, bio: true,
        profileImage: true, carImage: true, carMake: true, carModel: true, carYear: true,
        hourlyRate: true, vehicleTypes: true, serviceRadiusKm: true, baseAddress: true,
        licenseNumber: true, insuranceNumber: true, languages: true,
        isActive: true, isVerified: true,
        whatsapp: true, instagram: true, facebook: true, yearsExperience: true,
      } as any
    })

    return NextResponse.json(instructor)
  } catch (error) {
    console.error('Fetch profile error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const ref = await getInstructorFromSession(session)
    if (!ref) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Read-only guard — inactive instructors can view but not edit profile
    const subCheck = await requireActiveSubscription(session!.user.id)
    if (!subCheck.valid) {
      return NextResponse.json({ error: subCheck.message, requiresSubscription: true }, { status: 403 })
    }

    const body = await req.json()
    const data = profileSchema.parse(body)

    const instructor = await prisma.instructor.update({
      where: { id: ref.id },
      data: {
        name: data.name,
        phone: data.phone,
        bio: data.bio,
        profileImage: data.profileImage,
        carImage: data.carImage,
        carMake: data.carMake,
        carModel: data.carModel,
        carYear: data.carYear,
        ...(data.whatsapp !== undefined && { whatsapp: data.whatsapp }),
        ...(data.instagram !== undefined && { instagram: data.instagram }),
        ...(data.facebook !== undefined && { facebook: data.facebook }),
        ...(data.yearsExperience !== undefined && { yearsExperience: data.yearsExperience }),
        ...(data.baseAddress !== undefined && { baseAddress: data.baseAddress }),
        ...(data.licenseNumber !== undefined && { licenseNumber: data.licenseNumber }),
        ...(data.insuranceNumber !== undefined && { insuranceNumber: data.insuranceNumber }),
        ...(data.languages !== undefined && { languages: data.languages }),
      } as any
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
