import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getDisplayName } from '@/lib/utils/account'
import { mergeDrivingProfile } from '@/lib/extensions/driving/providerProfile'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    // Resolve by ID first, then by customSlug — supports /book/[id] and /book/[slug]
    const instructor = await prisma.provider.findFirst({
      where: {
        OR: [
          { id },
          { customSlug: id },
        ],
      },
      select: {
        id: true,
        name: true,
        businessName: true,
        accountType: true,
        phone: true,
        bio: true,
        profileImage: true,
        hourlyRate: true,
        averageRating: true,
        totalReviews: true,
        baseAddress: true,
        serviceRadiusKm: true,
        allowedDurations: true,
      }
    })

    if (!instructor) {
      return NextResponse.json(
        { error: 'Instructor not found' },
        { status: 404 }
      )
    }

    // Merge driving-specific fields from extension table
    const withDriving = await mergeDrivingProfile(instructor.id, instructor as any)
    const testPackageIncludes = Array.isArray((withDriving as any).testPackageIncludes)
      ? (withDriving as any).testPackageIncludes
      : []

    return NextResponse.json({
      ...withDriving,
      displayName: getDisplayName(instructor as any),
      testPackageIncludes,
    })
  } catch (error) {
    console.error('Error fetching instructor:', error)
    return NextResponse.json(
      { error: 'Failed to fetch instructor' },
      { status: 500 }
    )
  }
}
