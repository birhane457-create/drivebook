import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getDisplayName } from '@/lib/utils/account'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    const instructor = await prisma.instructor.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        businessName: true,
        accountType: true,
        phone: true,
        bio: true,
        profileImage: true,
        carImage: true,
        carMake: true,
        carModel: true,
        carYear: true,
        hourlyRate: true,
        averageRating: true,
        totalReviews: true,
        baseAddress: true,
        serviceRadiusKm: true,
        allowedDurations: true,
        offersTestPackage: true,
        testPackagePrice: true,
        testPackageDuration: true,
        testPackageIncludes: true,
      }
    })

    if (!instructor) {
      return NextResponse.json(
        { error: 'Instructor not found' },
        { status: 404 }
      )
    }

    const testPackageIncludes = Array.isArray((instructor.testPackageIncludes as any))
      ? (instructor.testPackageIncludes as any)
      : []

    return NextResponse.json({
      ...instructor,
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
