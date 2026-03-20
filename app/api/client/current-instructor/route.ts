import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Get the client record for this user
    const client = await prisma.client.findFirst({
      where: { userId: user.id },
      select: { 
        id: true,
        preferredInstructorId: true
      }
    })

    if (!client) {
      return NextResponse.json({ currentInstructor: null })
    }

    let instructorId = client.preferredInstructorId

    // If no preferred instructor, get from latest booking
    if (!instructorId) {
      const latestBooking = await prisma.booking.findFirst({
        where: {
          clientId: client.id,
          status: { in: ['CONFIRMED', 'COMPLETED', 'PENDING'] }
        },
        select: { instructorId: true },
        orderBy: { createdAt: 'desc' }
      })
      
      instructorId = latestBooking?.instructorId || null
    }

    if (!instructorId) {
      return NextResponse.json({ currentInstructor: null })
    }

    // Get instructor details
    const instructor = await prisma.instructor.findUnique({
      where: { id: instructorId },
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
        averageRating: true,
        totalReviews: true,
        baseAddress: true,
        lessonPackages: true,
        userId: true,
      }
    })

    if (!instructor) {
      return NextResponse.json({ currentInstructor: null })
    }

    // Get package info if this booking is a package
    let packageInfo = null
    const latestPackageBooking = await prisma.booking.findFirst({
      where: {
        clientId: client.id,
        instructorId: instructor.id,
        isPackageBooking: true
      },
      orderBy: { createdAt: 'desc' }
    })

    if (latestPackageBooking && latestPackageBooking.isPackageBooking) {
      // Calculate used hours from completed child bookings linked to this package
      const childBookings = await prisma.booking.findMany({
        where: {
          OR: [
            { parentBookingId: latestPackageBooking.id },
            // Also count the first booking itself if completed
            { id: latestPackageBooking.id, status: 'COMPLETED' }
          ],
          status: { in: ['COMPLETED', 'CONFIRMED'] }
        },
        select: { duration: true, startTime: true, endTime: true }
      });

      const usedHours = childBookings.reduce((sum, b) => {
        if (b.duration) return sum + b.duration;
        if (b.startTime && b.endTime) {
          return sum + (new Date(b.endTime).getTime() - new Date(b.startTime).getTime()) / (1000 * 60 * 60);
        }
        return sum;
      }, 0);

      const totalHours = latestPackageBooking.packageHours || 0;
      const remaining = Math.max(0, totalHours - usedHours);

      packageInfo = {
        totalHours,
        usedHours: Math.round(usedHours * 10) / 10,
        remainingHours: Math.round(remaining * 10) / 10,
        expiryDate: latestPackageBooking.packageExpiryDate,
        status: latestPackageBooking.packageStatus
      }
    }

    // Default services
    const services = [
      'Regular Driving Lessons',
      'PDA Test Package',
      'Mock Test'
    ]

    // Parse lesson packages for service pricing
    const packages = (instructor.lessonPackages as any[]) || []
    const activePackages = packages.filter((p: any) => p.isActive !== false)

    return NextResponse.json({
      currentInstructor: {
        id: instructor.id,
        name: instructor.name,
        profileImage: instructor.profileImage,
        carImage: instructor.carImage,
        carMake: instructor.carMake,
        carModel: instructor.carModel,
        carYear: instructor.carYear,
        phone: instructor.phone,
        email: instructor.userId
          ? (await prisma.user.findUnique({ where: { id: instructor.userId }, select: { email: true } }))?.email || ''
          : '',
        baseAddress: instructor.baseAddress,
        hourlyRate: instructor.hourlyRate,
        bio: instructor.bio,
        averageRating: instructor.averageRating || 4.5,
        totalReviews: instructor.totalReviews || 0,
        offersTestPackage: true,
        services,
        lessonPackages: activePackages,
      },
      packageInfo,
      latestBookingId: latestPackageBooking?.id,
      latestBookingStatus: latestPackageBooking?.status
    })
  } catch (error) {
    console.error('Error fetching current instructor:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
