import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { safeClientSelect, sanitizeClientForInstructor, logDataAccess } from '@/lib/utils/sanitize'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { requireActiveSubscription } from '@/lib/middleware/subscriptionValidation'

export const dynamic = 'force-dynamic'

const clientSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  phone: z.string().min(1, 'Phone is required'),
  email: z.string().email('Valid email address is required'),
  // frontend sends "addressText"
  addressText: z.string().optional(),
  defaultPickupAddress: z.string().optional(),
  defaultPickupLat: z.number().optional(),
  defaultPickupLng: z.number().optional(),
  notes: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.instructorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Subscription / read-only gate — cannot add new clients when inactive
    const subCheck = await requireActiveSubscription(session.user.id)
    if (!subCheck.valid) {
      return NextResponse.json({ error: subCheck.message, requiresSubscription: true }, { status: 403 })
    }

    const body = await req.json()
    const data = clientSchema.parse(body)

    const pickupAddress = data.addressText ?? data.defaultPickupAddress
    const normalizedEmail = data.email.trim().toLowerCase()

    // Prevent duplicate client records for the same instructor/email pair.
    const existingClient = await prisma.client.findFirst({
      where: {
        instructorId: session.user.instructorId,
        email: normalizedEmail,
      },
    })

    if (existingClient) {
      return NextResponse.json(existingClient, { status: 200 })
    }

    // ── Silently create or link a User account ────────────────────────────────
    // Every client gets a userId from day one so the instructor can book for
    // them immediately. No email is sent here — the first email fires when the
    // instructor actually creates a booking (wallet top-up prompt).
    let userId: string

    const existingUser = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase() },
    })

    let client: any

    if (existingUser) {
      // Student already has an account — wrap client creation in a transaction
      // in case it fails (e.g. unique constraint race). Wallet already exists.
      userId = existingUser.id

      client = await (prisma as any).$transaction(async (tx: any) => {
        return tx.client.create({
          data: {
            instructorId: session.user.instructorId,
            userId,
            name: data.name,
            phone: data.phone,
            email: data.email.toLowerCase(),
            defaultPickupAddress: pickupAddress,
            defaultPickupLat: data.defaultPickupLat,
            defaultPickupLng: data.defaultPickupLng,
            notes: data.notes,
          },
        })
      })
    } else {
      // Create a dormant account with a random password + set-password token.
      // All three writes (user, wallet, client) are wrapped in a single transaction
      // so a partial failure cannot leave orphaned user/wallet records.
      const tempPassword = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10)
      const setPasswordToken = crypto.randomBytes(32).toString('hex')
      const setPasswordExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days

      client = await (prisma as any).$transaction(async (tx: any) => {
        const newUser = await tx.user.create({
          data: {
            email: data.email.toLowerCase(),
            name: data.name,
            password: tempPassword,
            role: 'CLIENT',
            resetToken: setPasswordToken,
            resetTokenExpiry: setPasswordExpiry,
          } as any,
        })

        // Wallet created inside the same transaction — rolls back if client.create fails
        await tx.clientWallet.create({
          data: { userId: newUser.id, balance: 0 },
        })

        return tx.client.create({
          data: {
            instructorId: session.user.instructorId,
            userId: newUser.id,
            name: data.name,
            phone: data.phone,
            email: data.email.toLowerCase(),
            defaultPickupAddress: pickupAddress,
            defaultPickupLat: data.defaultPickupLat,
            defaultPickupLng: data.defaultPickupLng,
            notes: data.notes,
          },
        })
      })
    }

    return NextResponse.json(client, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', ')
      return NextResponse.json({ error: 'Validation failed', details: errorMessages }, { status: 400 })
    }
    console.error('Client creation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.instructorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Pagination params
    const { searchParams } = new URL(req.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '25')))
    const skip = (page - 1) * limit
    // BUG-7 FIX: accept search param for server-side filtering across all pages
    const search = searchParams.get('search')?.trim() ?? ''

    const whereClause = {
      instructorId: session.user.instructorId,
      ...(search
        ? {
            OR: [
              { name:  { contains: search, mode: 'insensitive' as const } },
              { email: { contains: search, mode: 'insensitive' as const } },
              { phone: { contains: search } },
            ],
          }
        : {}),
    }

    // Get total count
    const total = await prisma.client.count({ where: whereClause })

    const clients = await prisma.client.findMany({
      where: whereClause,
      select: safeClientSelect,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip,
    })

    const sanitizedClients = clients.map(sanitizeClientForInstructor)

    await logDataAccess(
      prisma,
      session.user.instructorId,
      'INSTRUCTOR',
      'CLIENT',
      clients.map(c => c.id),
      'VIEW',
      req.headers.get('x-forwarded-for')
    )

    return NextResponse.json({
      clients: sanitizedClients,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasMore: page < Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Fetch clients error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
