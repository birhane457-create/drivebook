import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { mergeDrivingProfile } from '@/lib/extensions/driving/providerProfile'

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
      where: { email: session!.user!.email }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Get the client record for this user
    const client = await prisma.customer.findFirst({
      where: { userId: user.id },
      select: { 
        id: true,
        preferredProviderId: true
      }
    })

    if (!client) {
      return NextResponse.json({ currentInstructor: null })
    }

    let providerId = client.preferredProviderId

    // If no preferred instructor, get from latest booking
    if (!providerId) {
      const latestBooking = await prisma.booking.findFirst({
        where: {
          customerId: client.id,
          status: { in: ['CONFIRMED', 'COMPLETED', 'PENDING'] }
        },
        select: { providerId: true },
        orderBy: { createdAt: 'desc' }
      }) as any
      
      providerId = latestBooking?.providerId || null
    }

    if (!providerId) {
      return NextResponse.json({ currentInstructor: null })
    }

    // Get instructor details (core fields only — driving fields come from extension)
    const instructor = await prisma.provider.findUnique({
      where: { id: providerId },
      select: {
        id: true,
        name: true,
        phone: true,
        bio: true,
        profileImage: true,
        hourlyRate: true,
        averageRating: true,
        totalReviews: true,
        baseAddress: true,
        userId: true,
      }
    }) as any

    if (!instructor) {
      return NextResponse.json({ currentInstructor: null })
    }

    // Merge driving-specific fields from extension table
    const withDriving = await mergeDrivingProfile(instructor.id, instructor as any) as any

    // Get package info if this booking is a package
    let packageInfo = null
    const latestPackageBooking = await prisma.booking.findFirst({
      where: {
        customerId: client.id,
        providerId: instructor.id,
        isPackageBooking: true
      },
      orderBy: { createdAt: 'desc' }
    }) as any

    if (latestPackageBooking && latestPackageBooking.isPackageBooking) {      // Calculate used hours from completed child bookings linked to this package
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
      } as any);

      const usedHours = childBookings.reduce((sum: any, b: any) => {
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

    // Build dynamic services from instructor setup
    interface ServiceItem {
      name: string
      duration?: number
      price?: number
      includes?: string[]
    }
    
    const dynamicServices: ServiceItem[] = []

    // Regular lesson is always available
    dynamicServices.push({
      name: 'Regular Lesson',
      duration: 60 // Default 1 hour
    })

    if (withDriving.offersTestPackage) {
      dynamicServices.push({
        name: 'PDA Test Package',
        duration: withDriving.testPackageDuration || undefined,
        price: withDriving.testPackagePrice || undefined,
        includes: Array.isArray(withDriving.testPackageIncludes) 
          ? (withDriving.testPackageIncludes as string[])
          : undefined
      })
    }

    return NextResponse.json({
      currentInstructor: {
        id: instructor.id,
        name: instructor.name,
        profileImage: instructor.profileImage,
        carImage: (instructor as any).carImage,
        carMake: withDriving.carMake,
        carModel: withDriving.carModel,
        carYear: withDriving.carYear,
        phone: instructor.phone,
        email: instructor.userId
          ? (await prisma.user.findUnique({ where: { id: instructor.userId }, select: { email: true } }))?.email || ''
          : '',
        baseAddress: instructor.baseAddress,
        hourlyRate: instructor.hourlyRate,
        bio: instructor.bio,
        averageRating: instructor.averageRating || 4.5,
        totalReviews: instructor.totalReviews || 0,
        services: dynamicServices,
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
