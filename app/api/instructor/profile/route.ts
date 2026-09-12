import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { requireActiveSubscription } from '@/lib/middleware/subscriptionValidation'
import { mergeDrivingProfile, upsertDrivingProfile } from '@/lib/extensions/driving/providerProfile'
import { getProviderProfile } from '@/lib/core/getProviderProfile'

export const dynamic = 'force-dynamic';

const profileSchema = z.object({
  name: z.string(),
  phone: z.string(),
  bio: z.string().optional(),
  profileImage: z.string().optional(),
  carImage: z.string().optional(),
  carMake: z.string().optional(),
  carModel: z.string().optional(),
  carYear: z.union([z.number(), z.string()]).optional().nullable().transform(v =>
    v === null || v === undefined ? null : String(v)
  ),
  whatsapp: z.string().optional().nullable(),
  instagram: z.string().optional().nullable(),
  facebook: z.string().optional().nullable(),
  yearsExperience: z.number().optional().nullable(),
  baseAddress: z.string().optional().nullable(),
  licenseNumber: z.string().optional().nullable(),
  insuranceNumber: z.string().optional().nullable(),
  languages: z.union([
    z.array(z.string()),
    z.string(),
  ]).optional().nullable().transform(v => {
    if (!v) return null
    if (Array.isArray(v)) return v.filter(Boolean).join(',')
    return v
  }),
  videoUrl: z.string().url().optional().nullable().or(z.literal('')).transform(v => v || null),
  specialties: z.union([
    z.array(z.string()),
    z.string(),
  ]).optional().nullable().transform(v => {
    if (!v) return null
    if (Array.isArray(v)) return v.filter(Boolean).join(',')
    return v
  }),
})

// Helper: find provider by session (handles null providerId via userId fallback)
async function getInstructorFromSession(session: any) {
  if (!session?.user) return null
  if (session!.user!.providerId) {
    return prisma.provider.findUnique({ where: { id: session!.user!.providerId }, select: { id: true } })
  }
  // Fallback for SUPER_ADMIN / ADMIN accounts where providerId isn't in the JWT
  return prisma.provider.findFirst({ where: { userId: session!.user!.id }, select: { id: true } })
}

export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const ref = await getInstructorFromSession(session)
    if (!ref) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const instructor = await prisma.provider.findUnique({
      where: { id: ref.id },
      select: {
        id: true, name: true, phone: true, bio: true,
        profileImage: true,
        hourlyRate: true, serviceRadiusKm: true, baseAddress: true,
        languages: true,
        isActive: true, isVerified: true,
        whatsapp: true, instagram: true, facebook: true, yearsExperience: true,
        videoUrl: true, specialties: true,
        abn: true, abnVerified: true,
        workingHours: true,
        subscriptionStatus: true,
        approvalStatus: true,
        trialEndsAt: true,
        businessModel: true,  // needed by getProviderProfile to detect driving
      }  as any
    })

    // Resolve full profile through extension boundary
    const response = await getProviderProfile(instructor as any)
    return NextResponse.json(response)
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

    // Read-only guard � inactive instructors can view but not edit profile
    const subCheck = await requireActiveSubscription(session!.user.id)
    if (!subCheck.valid) {
      return NextResponse.json({ error: subCheck.message, requiresSubscription: true }, { status: 403 })
    }

    const body = await req.json()
    const data = profileSchema.parse(body)

    // Separate driving-specific fields from generic provider fields
    const drivingUpdate: Record<string, unknown> = {}
    if (data.carMake !== undefined) drivingUpdate.carMake = data.carMake
    if (data.carModel !== undefined) drivingUpdate.carModel = data.carModel
    if (data.carYear !== undefined) drivingUpdate.carYear = data.carYear
    if (data.licenseNumber !== undefined) drivingUpdate.licenseNumber = data.licenseNumber
    if (data.insuranceNumber !== undefined) drivingUpdate.insuranceNumber = data.insuranceNumber
    if (data.carImage !== undefined) drivingUpdate.carImage = data.carImage

    const instructor = await prisma.provider.update({
      where: { id: ref.id },
      data: {
        name: data.name,
        phone: data.phone,
        bio: data.bio,
        profileImage: data.profileImage,
        ...(data.whatsapp !== undefined && { whatsapp: data.whatsapp }),
        ...(data.instagram !== undefined && { instagram: data.instagram }),
        ...(data.facebook !== undefined && { facebook: data.facebook }),
        ...(data.yearsExperience !== undefined && { yearsExperience: data.yearsExperience }),
        ...(data.baseAddress !== undefined && { baseAddress: data.baseAddress }),
        ...(data.baseAddress ? await (async () => {
          const { parseAuAddress } = await import('@/lib/data/au-locations');
          const parsed = parseAuAddress(data.baseAddress!);
          return {
            ...(parsed.suburb   ? { suburb:           parsed.suburb }   : {}),
            ...(parsed.state    ? { state:             parsed.state }    : {}),
            ...(parsed.postcode ? { postcode:          parsed.postcode } : {}),
            ...(parsed.lat !== null ? { baseLatitude: parsed.lat, baseAddressLat: parsed.lat } : {}),
            ...(parsed.lng !== null ? { baseLongitude: parsed.lng, baseAddressLng: parsed.lng } : {}),
          };
        })() : {}),
        ...(data.languages !== undefined && { languages: data.languages }),
        ...(data.videoUrl !== undefined && { videoUrl: data.videoUrl }),
        ...(data.specialties !== undefined && { specialties: data.specialties }),
      } as any,
      select: { id: true, businessModel: true },
    })

    // Write driving-specific fields to the extension table (dual-write)
    if (Object.keys(drivingUpdate).length > 0) {
      await upsertDrivingProfile(ref.id, drivingUpdate as any)
    }

    // Resolve full profile through extension boundary
    const response = await getProviderProfile(instructor as any)
    return NextResponse.json(response)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    console.error('Update profile error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
