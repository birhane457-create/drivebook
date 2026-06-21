import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { emailService } from '@/lib/services/email'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.instructorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { clientId, topUpAmount, lessonPrice, shortfall, platformFeeRate, lessonDate } = await req.json()

    if (!clientId || !topUpAmount) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Verify client belongs to this instructor
    const client = await prisma.client.findFirst({
      where: { id: clientId, instructorId: session.user.instructorId }
    })

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    if (!client.email) {
      return NextResponse.json({ error: 'Client has no email address' }, { status: 422 })
    }

    const instructor = await prisma.instructor.findUnique({
      where: { id: session.user.instructorId },
      select: { name: true }
    })

    // Build the top-up URL — pre-fills the amount on the wallet page
    const baseUrl = process.env.NEXTAUTH_URL || 'https://drivebook.com.au'
    const topUpUrl = `${baseUrl}/client-dashboard/wallet?topup=${topUpAmount.toFixed(2)}`

    const feeRate = platformFeeRate ?? 0.036
    const lessonCost = lessonPrice ?? topUpAmount
    const shortfallAmt = shortfall ?? topUpAmount
    const platformFeeAmt = parseFloat((topUpAmount - shortfallAmt).toFixed(2))

    await emailService.sendGenericEmail({
      to: client.email,
      subject: `Action Required: Top up your DriveBook wallet to confirm your lesson`,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111827">
          <h2 style="color:#1d4ed8;margin-bottom:4px">Your lesson is almost booked!</h2>
          <p>Hi ${client.name},</p>
          <p>Your instructor <strong>${instructor?.name}</strong> has tried to book a lesson for you${lessonDate ? ` on <strong>${lessonDate}</strong>` : ''}, but your DriveBook wallet doesn't have enough credits.</p>

          <table style="border-collapse:collapse;width:100%;margin:20px 0;max-width:420px">
            <thead>
              <tr style="background:#f3f4f6">
                <th style="padding:10px 12px;border:1px solid #e5e7eb;text-align:left;font-size:13px;color:#6b7280">Description</th>
                <th style="padding:10px 12px;border:1px solid #e5e7eb;text-align:right;font-size:13px;color:#6b7280">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="padding:10px 12px;border:1px solid #e5e7eb">Lesson cost</td>
                <td style="padding:10px 12px;border:1px solid #e5e7eb;text-align:right">$${lessonCost.toFixed(2)}</td>
              </tr>
              <tr style="background:#fafafa">
                <td style="padding:10px 12px;border:1px solid #e5e7eb;color:#6b7280;font-size:13px">Platform processing fee (${(feeRate * 100).toFixed(1)}%) <span style="font-size:11px;color:#9ca3af">excl. GST</span></td>
                <td style="padding:10px 12px;border:1px solid #e5e7eb;text-align:right;color:#6b7280;font-size:13px">$${platformFeeAmt.toFixed(2)}</td>
              </tr>
              <tr style="background:#eff6ff">
                <td style="padding:10px 12px;border:1px solid #bfdbfe;font-weight:700">Amount to add</td>
                <td style="padding:10px 12px;border:1px solid #bfdbfe;text-align:right;font-weight:700;color:#1d4ed8">$${topUpAmount.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>

          <p>Click the button below to top up your wallet. The amount is pre-filled for you.</p>

          <a href="${topUpUrl}"
             style="display:inline-block;background:#2563eb;color:#fff;padding:13px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:16px;margin:8px 0">
            Top Up Wallet — $${topUpAmount.toFixed(2)}
          </a>

          <p style="margin-top:20px;color:#374151;font-size:14px">
            Once you've topped up, let your instructor know and they'll confirm the booking.
          </p>
          <p style="color:#9ca3af;font-size:12px;margin-top:8px">
            The top-up amount includes the platform processing fee (${(feeRate * 100).toFixed(1)}%, excl. GST).
          </p>
        </div>
      `
    })

    return NextResponse.json({ success: true, sentTo: client.email })
  } catch (error) {
    console.error('Send payment link error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
