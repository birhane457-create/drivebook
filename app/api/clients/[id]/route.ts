import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { logDataAccess } from '@/lib/utils/sanitize'


export const dynamic = 'force-dynamic';
const updateClientSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  phone: z.string().min(1, 'Phone is required'),
  email: z.string().email('Valid email address is required'),
  addressText: z.string().optional(),
  notes: z.string().optional()
})

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.providerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const data = updateClientSchema.parse(body)

    // Verify client belongs to instructor and check if they have a user account
    const existingClient = await prisma.customer.findUnique({
      where: { id: params.id },
      select: { 
        preferredProviderId: true,
        userId: true,
        email: true,
        user: {
          select: {
            email: true
          }
        }
      }
    })

    if (!existingClient || existingClient.preferredProviderId !== session!.user!.providerId) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    // Check if client has a user account and email is being changed
    if (existingClient.userId && existingClient.email !== data.email) {
      return NextResponse.json({ 
        error: 'Cannot change email', 
        details: 'This client has a user account. They must change their email through their account settings.',
        hasUserAccount: true
      }, { status: 400 })
    }

    // Update client
    const client = await prisma.customer.update({
      where: { id: params.id },
      data: {
        name: data.name,
        phone: data.phone,
        email: data.email,
        // store under defaultPickupAddress column
        defaultPickupAddress: data.addressText,
        notes: data.notes
      }
    })

    // FIXED: Log data modification for GDPR compliance
    await logDataAccess(
      prisma,
      session!.user!.providerId,
      'provider',
      'CLIENT',
      [params.id],
      'MODIFY',
      req.headers.get('x-forwarded-for')
    )

    return NextResponse.json(client)
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', ')
      return NextResponse.json({ 
        error: 'Validation failed', 
        details: errorMessages,
        fields: error.errors 
      }, { status: 400 })
    }
    console.error('Update client error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.providerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify client belongs to instructor
    const existingClient = await prisma.customer.findUnique({
      where: { id: params.id },
      select: { 
        preferredProviderId: true, 
        userId: true,
        email: true,
        bookings: {
          select: { id: true },
          take: 1,
        },
      }
    })

    if (!existingClient || existingClient.preferredProviderId !== session!.user!.providerId) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    // IMPORTANT: Never hard delete customers with user accounts or bookings
    // Soft delete preserves referential integrity for:
    // - Financial records (bookings, transactions, wallet)
    // - Audit trails (who did what when)
    // - User account data (if they log in, their data is intact)
    const hasBookings = existingClient.bookings.length > 0
    const hasUserAccount = !!existingClient.userId

    if (hasUserAccount) {
      // User has an account — they own their data
      // Provider can only hide them from their client list
      await prisma.customer.update({
        where: { id: params.id },
        data: {
          deletedAt: new Date(),
          deletedBy: session!.user!.providerId,
          status: 'DELETED', // Hide from provider's client list
        }
      })

      await logDataAccess(
        prisma,
        session!.user!.providerId,
        'provider',
        'CLIENT',
        [params.id],
        'DELETE',
        req.headers.get('x-forwarded-for')
      )

      return NextResponse.json({ 
        success: true,
        message: 'Client hidden from your list. Their account and data remain intact.',
        softDelete: true,
      })
    }

    if (hasBookings) {
      // No user account but has bookings — soft delete to preserve financial records
      await prisma.customer.update({
        where: { id: params.id },
        data: {
          deletedAt: new Date(),
          deletedBy: session!.user!.providerId,
          status: 'DELETED',
        }
      })

      await logDataAccess(
        prisma,
        session!.user!.providerId,
        'provider',
        'CLIENT',
        [params.id],
        'DELETE',
        req.headers.get('x-forwarded-for')
      )

      return NextResponse.json({ 
        success: true,
        message: 'Client deleted. Booking history preserved for records.',
        softDelete: true,
      })
    }

    // No user account, no bookings — safe to hard delete
    await prisma.customer.delete({
      where: { id: params.id }
    })

    await logDataAccess(
      prisma,
      session!.user!.providerId,
      'provider',
      'CLIENT',
      [params.id],
      'DELETE',
      req.headers.get('x-forwarded-for')
    )

    return NextResponse.json({ 
      success: true,
      message: 'Client permanently deleted.',
      softDelete: false,
    })
  } catch (error) {
    console.error('Delete client error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
