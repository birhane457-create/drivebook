import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { normalizeEmail } from '@/lib/auth-email'

export const dynamic = 'force-dynamic'

/**
 * Seed lesson packages for an instructor to test dynamic services feature
 * Usage: GET /api/seed/instructor-services?instructorEmail=test@example.com
 */
export async function GET(req: NextRequest) {
  try {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const session = await getServerSession(authOptions)
    if (!session?.user || !['ADMIN', 'SUPER_ADMIN'].includes((session.user as any).role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const instructorEmail = searchParams.get('instructorEmail')

    if (!instructorEmail) {
      return NextResponse.json(
        { error: 'instructorEmail parameter required' },
        { status: 400 }
      )
    }

    const normalizedEmail = normalizeEmail(instructorEmail)

    // Find instructor by email
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    })

    if (!user) {
      return NextResponse.json(
        { error: `User not found: ${instructorEmail}` },
        { status: 404 }
      )
    }

    const instructor = await prisma.instructor.findUnique({
      where: { userId: user.id }
    })

    if (!instructor) {
      return NextResponse.json(
        { error: `Instructor not found for user: ${instructorEmail}` },
        { status: 404 }
      )
    }

    // Seed: enable instructor PDA test pack + create a PDATestConfig
    const { updatedInstructor, pdaConfig } = await prisma.$transaction(async (tx) => {
      const updatedInstructor = await tx.instructor.update({
        where: { id: instructor.id },
        data: {
          offersTestPackage: true,
          testPackagePrice: 225,
          testPackageDuration: 165,
          testPackageIncludes: ['pickup', 'dropoff', 'debriefing'],
        },
      });

      const pdaConfig = await tx.pDATestConfig.create({
        data: {
          instructorId: instructor.id,
          name: 'Standard PDA Test',
          durationMinutes: 165,
          price: 225,
          discountPercent: null,
          includes: { pickup: true, dropoff: true, debriefing: true } as any,
          isActive: true,
        },
      });

      return { updatedInstructor, pdaConfig };
    });

    return NextResponse.json({
      success: true,
      message: `Seeded services for instructor: ${instructor.name}`,
      instructor: {
        id: updatedInstructor.id,
        name: updatedInstructor.name,
        hourlyRate: updatedInstructor.hourlyRate,
        offersTestPackage: updatedInstructor.offersTestPackage,
        testPackagePrice: updatedInstructor.testPackagePrice,
        testPackageDuration: updatedInstructor.testPackageDuration,
      }
      ,
      pdaConfig: {
        id: pdaConfig.id,
        name: pdaConfig.name,
        durationMinutes: pdaConfig.durationMinutes,
        price: pdaConfig.price,
        isActive: pdaConfig.isActive,
      },
    })
  } catch (error) {
    console.error('Error seeding instructor services:', error)
    return NextResponse.json(
      { error: 'Failed to seed instructor services' },
      { status: 500 }
    )
  }
}
