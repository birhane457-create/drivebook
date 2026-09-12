import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/business/config
 * Fetch current business terminology and capabilities
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.providerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Derive businessId from providerId (set as `biz_${provider.id}` at registration)
    const businessId = `biz_${session!.user!.providerId}`

    // Fetch business with terminology and capabilities
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: {
        paymentModel: true,
        terminology: true,
        capabilities: true,
      },
    })

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    const config = {
      terminology: {
        provider: business.terminology?.provider || 'Provider',
        providers: business.terminology?.providers || 'Providers',
        customer: business.terminology?.customer || 'Customer',
        customers: business.terminology?.customers || 'Customers',
        booking: business.terminology?.booking || 'Booking',
        bookings: business.terminology?.bookings || 'Bookings',
        service: business.terminology?.service || 'Service',
        services: business.terminology?.services || 'Services',
        providerGroup: business.terminology?.providerGroup || 'Business',
      },
      capabilities: {
        onlineBooking: business.capabilities?.onlineBooking ?? true,
        onlinePayments: business.capabilities?.onlinePayments ?? true,
        quotes: business.capabilities?.quotes ?? false,
        packages: business.capabilities?.packages ?? true,
        waitingList: business.capabilities?.waitingList ?? false,
        reviews: business.capabilities?.reviews ?? true,
        aiReceptionist: business.capabilities?.aiReceptionist ?? false,
        voiceLine: business.capabilities?.voiceLine ?? false,
        mobileApp: business.capabilities?.mobileApp ?? false,
        googleCalendar: business.capabilities?.googleCalendar ?? true,
        documentVerification: business.capabilities?.documentVerification ?? false,
        travelTime: business.capabilities?.travelTime ?? false,
        assessmentTracking: business.capabilities?.assessmentTracking ?? false,
        websiteBuilder: business.capabilities?.websiteBuilder ?? true,
        wallet: business.capabilities?.wallet ?? false,
        payouts: business.capabilities?.payouts ?? false,
        commission: business.capabilities?.commission ?? false,
      },
    }

    return NextResponse.json({
      config,
      paymentModel: business.paymentModel,
    })
  } catch (error) {
    console.error('GET /api/business/config error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/business/config
 * Update business terminology and capabilities
 */
export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.providerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Derive businessId from providerId (set as `biz_${provider.id}` at registration)
    const businessId = `biz_${session!.user!.providerId}`

    const body = await req.json()
    const { terminology, capabilities } = body

    // Validate terminology (all fields required)
    if (!terminology || typeof terminology !== 'object') {
      return NextResponse.json({ error: 'Invalid terminology data' }, { status: 400 })
    }

    const requiredTermFields = [
      'provider',
      'providers',
      'customer',
      'customers',
      'booking',
      'bookings',
      'service',
      'services',
      'providerGroup',
    ]

    for (const field of requiredTermFields) {
      if (!terminology[field] || typeof terminology[field] !== 'string' || !terminology[field].trim()) {
        return NextResponse.json(
          { error: `Terminology field '${field}' is required and cannot be empty` },
          { status: 400 }
        )
      }
    }

    // Validate capabilities (boolean flags)
    if (!capabilities || typeof capabilities !== 'object') {
      return NextResponse.json({ error: 'Invalid capabilities data' }, { status: 400 })
    }

    // Update terminology
    await prisma.businessTerminology.update({
      where: { businessId: businessId },
      data: {
        provider: terminology.provider.trim(),
        providers: terminology.providers.trim(),
        customer: terminology.customer.trim(),
        customers: terminology.customers.trim(),
        booking: terminology.booking.trim(),
        bookings: terminology.bookings.trim(),
        service: terminology.service.trim(),
        services: terminology.services.trim(),
        providerGroup: terminology.providerGroup.trim(),
      },
    })

    // Get current payment model to prevent changing payment-model-specific capabilities
    const business = await prisma.business.findUnique({ where: { id: businessId }, select: { paymentModel: true } })

    // Update capabilities (excluding payment-model-specific ones)
    await prisma.businessCapabilities.update({
      where: { businessId: businessId },
      data: {
        onlineBooking: capabilities.onlineBooking ?? true,
        onlinePayments: capabilities.onlinePayments ?? true,
        quotes: capabilities.quotes ?? false,
        packages: capabilities.packages ?? true,
        waitingList: capabilities.waitingList ?? false,
        reviews: capabilities.reviews ?? true,
        aiReceptionist: capabilities.aiReceptionist ?? false,
        voiceLine: capabilities.voiceLine ?? false,
        mobileApp: capabilities.mobileApp ?? false,
        googleCalendar: capabilities.googleCalendar ?? true,
        documentVerification: capabilities.documentVerification ?? false,
        travelTime: capabilities.travelTime ?? false,
        assessmentTracking: capabilities.assessmentTracking ?? false,
        websiteBuilder: capabilities.websiteBuilder ?? true,
        // Payment model capabilities are NOT updated here - controlled by paymentModel
        // wallet, payouts, commission are set during onboarding based on paymentModel
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('PUT /api/business/config error:', error)
    return NextResponse.json(
      { error: 'Failed to update configuration', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
