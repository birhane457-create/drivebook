// app/api/auth/device-check/route.ts
//
// Called immediately after a successful login to record the browser device
// and send a notification email if it is new.
//
// The device token (UUID from localStorage) is the device identity.
// IP and User-Agent are stored as login context.

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import {
  recordDeviceLogin,
  validateDeviceToken,
  getClientIP,
  parseUserAgent,
} from '@/lib/services/deviceTracking'
import { emailService } from '@/lib/services/email'
import { DEFAULT_TIMEZONE } from '@/lib/utils/timezone'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || !session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const { deviceToken } = body

    // Reject missing or malformed tokens silently — don't block login
    if (!validateDeviceToken(deviceToken)) {
      return NextResponse.json({ success: true, isNewDevice: false })
    }

    const ipAddress = getClientIP(req.headers)
    const userAgent = req.headers.get('user-agent') || 'Unknown'

    const { isNewDevice, deviceId } = await recordDeviceLogin(
      session.user.id,
      deviceToken,
      ipAddress,
      userAgent,
    )

    if (isNewDevice) {
      // Fire-and-forget — never let email failure block the login response
      const displayName = (session.user as any).name
        ?? session.user.email.split('@')[0]

      sendNewDeviceEmail(
        session.user.email,
        displayName,
        ipAddress,
        userAgent,
      ).catch(err => {
        console.error('[DeviceCheck] Email notification failed:', err)
      })
    }

    return NextResponse.json({ success: true, isNewDevice, deviceId })

  } catch (error) {
    console.error('[DeviceCheck] Unexpected error:', error)
    // Always return success — device tracking must never break the login flow
    return NextResponse.json({ success: true })
  }
}

// ── Email ─────────────────────────────────────────────────────────────────────

async function sendNewDeviceEmail(
  email: string,
  name: string,
  ipAddress: string,
  userAgent: string,
) {
  const deviceInfo = parseUserAgent(userAgent)
  const timestamp = new Date().toLocaleString('en-AU', {
    timeZone: DEFAULT_TIMEZONE,
    dateStyle: 'long',
    timeStyle: 'short',
  })

  // Partial IP only — show first two octets for context, mask the rest
  const octets = ipAddress.split('.')
  const maskedIP = octets.length === 4
    ? `${octets[0]}.${octets[1]}.xxx.xxx`
    : ipAddress

  const resetUrl = `${process.env.NEXTAUTH_URL}/reset-password`

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .accent { height: 4px; background: linear-gradient(to right, #0ea5e9, #2563eb); }
        .header { background: #0f172a; color: white; padding: 24px 28px; }
        .header h2 { margin: 0; font-size: 18px; }
        .header p { margin: 6px 0 0; font-size: 13px; opacity: 0.7; }
        .content { background: #f9fafb; padding: 28px; }
        .device-box { background: white; padding: 18px; margin: 18px 0; border-radius: 8px; border-left: 4px solid #0ea5e9; }
        .device-box p { margin: 4px 0; font-size: 14px; }
        .alert-box { background: #fef2f2; padding: 18px; margin: 18px 0; border-radius: 8px; border-left: 4px solid #ef4444; }
        .alert-box p { margin: 0 0 10px; font-size: 14px; }
        .alert-box ol { margin: 0; padding-left: 20px; font-size: 14px; }
        .button { display: inline-block; background: #ef4444; color: white; padding: 11px 22px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px; margin-top: 14px; }
        .note { color: #6b7280; font-size: 12px; margin-top: 20px; }
        .footer { background: #f1f5f9; padding: 14px 28px; text-align: center; font-size: 12px; color: #94a3b8; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="accent"></div>
        <div class="header">
          <h2>&#x1F510; New login detected</h2>
          <p>DriveBook Security Alert</p>
        </div>
        <div class="content">
          <p>Hi ${name},</p>
          <p>Your DriveBook account was just accessed from a browser we have not seen before.</p>

          <div class="device-box">
            <p><strong>Device:</strong> ${deviceInfo}</p>
            <p><strong>Time:</strong> ${timestamp} (AWST)</p>
            <p><strong>IP address:</strong> ${maskedIP}</p>
          </div>

          <p><strong>If this was you</strong> &mdash; no action needed.</p>

          <div class="alert-box">
            <p><strong>&#x1F6A8; If this was NOT you:</strong></p>
            <ol>
              <li>Reset your password immediately</li>
              <li>Contact support if you need help securing your account</li>
            </ol>
            <div>
              <a href="${resetUrl}" class="button">Reset Password Now</a>
            </div>
          </div>

          <p class="note">
            We send this notification whenever your account is accessed from a new browser.
            Once a browser is recognised, you will not receive this alert for it again.
          </p>
        </div>
        <div class="footer">
          DriveBook &mdash; drivebook.com.au &mdash; This is an automated security notification.
        </div>
      </div>
    </body>
    </html>
  `

  await emailService.sendGenericEmail({
    from: 'DriveBook Account Verification <verification@drivebook.com.au>',
    to: email,
    subject: 'New login to your DriveBook account',
    html,
  })
}
