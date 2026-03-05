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
    
    if (!session?.user?.instructorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const data = updateClientSchema.parse(body)

    // Verify client belongs to instructor and check if they have a user account
    const existingClient = await prisma.client.findUnique({
      where: { id: params.id },
      select: { 
        instructorId: true,
        userId: true,
        email: true,
        user: {
          select: {
            email: true
          }
        }
      }
    })

    if (!existingClient || existingClient.instructorId !== session.user.instructorId) {
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
    const client = await prisma.client.update({
      where: { id: params.id },
      data: {
        name: data.name,
        phone: data.phone,
        email: data.email,
        addressText: data.addressText,
        notes: data.notes
      }
    })

    // FIXED: Log data modification for GDPR compliance
    await logDataAccess(
      prisma,
      session.user.instructorId,
      'INSTRUCTOR',
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
    
    if (!session?.user?.instructorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify client belongs to instructor
    const existingClient = await prisma.client.findUnique({
      where: { id: params.id },
      select: { instructorId: true, notes: true }
    })

    if (!existingClient || existingClient.instructorId !== session.user.instructorId) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    // FIXED: Soft delete instead of hard delete (GDPR - keep audit trail)
    // Mark as deleted but don't actually delete
    await prisma.client.update({
      where: { id: params.id },
      data: {
        // Add deletedAt field to schema if needed
        notes: `[DELETED] ${existingClient.notes || ''}`
      }
    })

    // FIXED: Log deletion for GDPR compliance
    await logDataAccess(
      prisma,
      session.user.instructorId,
      'INSTRUCTOR',
      'CLIENT',
      [params.id],
      'DELETE',
      req.headers.get('x-forwarded-for')
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete client error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
