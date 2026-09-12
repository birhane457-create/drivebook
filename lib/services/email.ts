import nodemailer from 'nodemailer'
import { resolveTimezone, timezoneFromState, formatLocalDate, formatLocalTime, DEFAULT_TIMEZONE } from '@/lib/utils/timezone'
import { formatSender } from '@/lib/email/senders'
import { EMAIL_EVENTS, type EmailEvent } from '@/lib/email/registry'
import { type EmailContext, resolveSender, resolveReplyTo } from '@/lib/email/context'
import { getDisplayName, type DisplayIdentitySource } from '@/lib/branding/getDisplayIdentity'

interface BookingConfirmationData {
  customerName: string
  customerEmail: string
  customerPhone?: string
  instructorName: string
  provider?: DisplayIdentitySource  // If provided, use getDisplayName() for white-label support
  instructorEmail: string
  instructorPhone?: string
  startTime: Date
  endTime: Date
  pickupAddress?: string
  timezone?: string  // provider's timezone Ã¢â‚¬â€ defaults to Perth for backward compatibility
}

interface PDATestReminderData {
  customerName: string
  customerEmail: string
  // White-label: pass provider object so getDisplayName() returns business name for PREMIUM tier.
  // instructorName is a fallback for legacy callers â€” prefer passing provider.
  provider?: DisplayIdentitySource
  instructorName?: string
  testDate: Date
  testTime: string
  testCenter: string
  timezone?: string
}

class EmailService {
  private transporter: nodemailer.Transporter

  constructor() {
    const port = parseInt(process.env.SMTP_PORT || '587')
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })
  }

  async sendBookingConfirmation(data: BookingConfirmationData) {
    const { customerName: customerName, customerEmail, customerPhone, instructorName, instructorEmail, instructorPhone, startTime, endTime, pickupAddress } = data
    const tz = resolveTimezone(data.timezone ?? DEFAULT_TIMEZONE)
    const providerName = data.provider ? getDisplayName(data.provider) : instructorName

    // Email to client
    await this.transporter.sendMail({
      from: formatSender('bookings'),
      to: customerEmail,
      subject: ((data as any).bookingLabel ?? 'Appointment') + ' Confirmed',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
            .info-box { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #2563eb; }
            .instructor-box { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #10b981; }
            .dashboard-box { background: #eff6ff; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #3b82f6; }
            .info-row { margin: 10px 0; }
            .label { font-weight: bold; color: #1f2937; }
            .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
            .next-steps { background: #eff6ff; padding: 15px; border-radius: 8px; margin: 20px 0; }
            .next-steps li { margin: 8px 0; }
            .button { display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 5px; font-weight: bold; }
            .button-secondary { background-color: #10b981; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0;">Ã°Å¸Å¡â€” Booking Confirmed!</h1>
            </div>
            <div class="content">
              <p>Hi ${customerName},</p>
              <p>Great news! Your  with <strong>${providerName}</strong> has been confirmed.</p>
              
              <div class="info-box">
                <div class="info-row">
                  <span class="label">Ã°Å¸â€œâ€¦ Date:</span> ${formatLocalDate(startTime, tz)}
                </div>
                <div class="info-row">
                  <span class="label">Ã°Å¸â€¢Â Time:</span> ${formatLocalTime(startTime, tz, { hour: '2-digit', minute: '2-digit' })} - ${formatLocalTime(endTime, tz, { hour: '2-digit', minute: '2-digit' })}
                </div>
                ${pickupAddress ? `
                <div class="info-row">
                  <span class="label">Ã°Å¸â€œÂ Pickup:</span> ${pickupAddress}
                </div>
                ` : ''}
              </div>

              <div class="instructor-box">
                <div class="info-row">
                  <span class="label">Ã°Å¸â€˜Â¨Ã¢â‚¬ÂÃ°Å¸ÂÂ« Your Instructor: ${providerName}</span>
                </div>
                ${instructorPhone ? `
                <div class="info-row">
                  <span class="label">Ã°Å¸â€œÂ± Phone:</span> <a href="tel:${instructorPhone}">${instructorPhone}</a>
                </div>
                ` : ''}
                <div class="info-row">
                  <span class="label">Ã°Å¸â€œÂ§ Email:</span> <a href="mailto:${instructorEmail}">${instructorEmail}</a>
                </div>
              </div>

              <div class="dashboard-box">
                <strong>Ã°Å¸â€œÂ± Manage Your Bookings Anytime</strong>
                <p style="margin: 10px 0;">Access your dashboard to view, reschedule, or manage all your lessons:</p>
                <div style="text-align: center;">
                  <a href="${process.env.NEXTAUTH_URL}/login" class="button">Login to Dashboard</a>
                </div>
                <p style="margin: 10px 0; font-size: 14px; color: #6b7280;">
                  Ã°Å¸â€™Â¡ <strong>Tip:</strong> Download our mobile app for easy access on the go!
                </p>
              </div>
              
              <div class="next-steps">
                <strong>Ã°Å¸â€œâ€¹ What to expect:</strong>
                <ul style="margin: 0; padding-left: 20px;">
                  <li>Be ready 5-10 minutes before your scheduled time</li>
                  <li>Your instructor will contact you with final location details if needed</li>
                  <li>Bring any required documents (license, insurance, etc.)</li>
                  <li>If you need to reschedule or cancel, please contact your instructor as soon as possible</li>
                </ul>
              </div>
              
              <p>See you soon!</p>
              
              <div class="footer">
                <p>Your Service Platform</p>
                <p style="font-size: 12px; color: #9ca3af;">
                  Login: ${customerEmail}
                </p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `
    })

    // Email to instructor
    await this.transporter.sendMail({
      from: formatSender('bookings'),
      to: instructorEmail,
      subject: `New Booking: ${customerName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
            .info-box { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #10b981; }
            .info-row { margin: 10px 0; }
            .label { font-weight: bold; color: #1f2937; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0;">Ã°Å¸â€œâ€¹ New Booking Received</h1>
            </div>
            <div class="content">
              <p>You have a new booking from <strong>${customerName}</strong></p>
              
              <div class="info-box">
                <div class="info-row">
                </div>
                <div class="info-row">
                  <span class="label">Ã°Å¸â€¢Â Time:</span> ${formatLocalTime(startTime, tz, { hour: '2-digit', minute: '2-digit' })} - ${formatLocalTime(endTime, tz, { hour: '2-digit', minute: '2-digit' })}
                </div>
                ${pickupAddress ? `
                <div class="info-row">
                  <span class="label">Ã°Å¸â€œÂ Pickup:</span> ${pickupAddress}
                </div>
                ` : ''}
                <div class="info-row">
                  <span class="label">Ã°Å¸â€œÂ§ Client Email:</span> ${customerEmail}
                </div>
                ${customerPhone ? `
                <div class="info-row">
                  <span class="label">Ã°Å¸â€œÂ± Client Phone:</span> <a href="tel:${customerPhone}">${customerPhone}</a>
                </div>
                ` : ''}
              </div>
              
              <p>Login to your dashboard to view more details.</p>
            </div>
          </div>
        </body>
        </html>
      `
    })
  }

  async sendPDATestReminder(data: PDATestReminderData) {
    const { customerName: customerName, customerEmail, instructorName, testDate, testTime, testCenter } = data
    const tz = resolveTimezone(data.timezone ?? DEFAULT_TIMEZONE)
    const providerName = data.provider ? getDisplayName(data.provider) : instructorName

    await this.transporter.sendMail({
      from: formatSender('bookings'),
      to: customerEmail,
      subject: 'Ã°Å¸Å½Â¯ Driving Test Tomorrow - Good Luck!',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
            .info-box { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #f59e0b; }
            .info-row { margin: 10px 0; }
            .label { font-weight: bold; color: #1f2937; }
            .tips { background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; }
            .tips ul { margin: 10px 0; padding-left: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0;">Ã°Å¸Å½Â¯ Your Driving Test is Tomorrow!</h1>
            </div>
            <div class="content">
              <p>Hi ${customerName},</p>
              <p>This is a friendly reminder that your PDA driving test is scheduled for tomorrow. You've got this!</p>
              
              <div class="info-box">
                <div class="info-row">
                  <span class="label">Ã°Å¸â€œâ€¦ Date:</span> ${formatLocalDate(testDate, tz)}
                </div>
                <div class="info-row">
                  <span class="label">Ã°Å¸â€¢Â Time:</span> ${testTime}
                </div>
                <div class="info-row">
                  <span class="label">Ã°Å¸â€œÂ Location:</span> ${testCenter}
                </div>
                <div class="info-row">
                  <span class="label">Ã°Å¸â€˜Â¨Ã¢â‚¬ÂÃ°Å¸ÂÂ« Instructor:</span> ${providerName}
                </div>
              </div>
              
              <div class="tips">
                <strong>Ã°Å¸â€œÂ Quick Tips:</strong>
                <ul>
                  <li>Get a good night's sleep</li>
                  <li>Arrive 15 minutes early</li>
                  <li>Bring your learner's permit and ID</li>
                  <li>Stay calm and drive as you've practiced</li>
                  <li>Remember to check your mirrors regularly</li>
                </ul>
              </div>
              
              <p>${providerName} will meet you there. Good luck - you're going to do great!</p>
              
              <p style="text-align: center; font-size: 24px; margin: 20px 0;">Ã°Å¸Ââ‚¬ Good Luck! Ã°Å¸Ââ‚¬</p>
            </div>
          </div>
        </body>
        </html>
      `
    })
  }

  async sendTestEmail() {
    try {
      await this.transporter.sendMail({
        from: formatSender('support'),
        to: process.env.SMTP_USER,
        subject: 'Test Email - DriveBook Setup',
        html: `
          <h2>Email Configuration Successful!</h2>
          <p>Your DriveBook email service is working correctly.</p>
          <p>You can now send booking confirmations and reminders to your clients.</p>
        `
      })
      return { success: true, message: 'Test email sent successfully' }
    } catch (error) {
      console.error('Test email error:', error)
      return { success: false, message: 'Failed to send test email', error }
    }
  }

  async sendPasswordResetEmail(data: { email: string; resetUrl: string; userName: string }) {
    const { email, resetUrl, userName } = data;

    await this.transporter.sendMail({
      from: formatSender('verification'),
      to: email,
      subject: 'Reset Your Password - DriveBook',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; background: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
            .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Ã°Å¸â€Â Password Reset Request</h1>
            </div>
            <div class="content">
              <p>Hello,</p>
              
              <p>We received a request to reset the password for your DriveBook account (<strong>${userName}</strong>).</p>
              
              <p>Click the button below to reset your password:</p>
              
              <div style="text-align: center;">
                <a href="${resetUrl}" class="button">Reset Password</a>
              </div>
              
              <p>Or copy and paste this link into your browser:</p>
              <p style="word-break: break-all; color: #2563eb;">${resetUrl}</p>
              
              <div class="warning">
                <strong>Ã¢Å¡Â Ã¯Â¸Â Important:</strong>
                <ul style="margin: 10px 0;">
                  <li>This link will expire in 1 hour</li>
                  <li>If you didn't request this reset, please ignore this email</li>
                  <li>Your password won't change until you create a new one</li>
                </ul>
              </div>
              
              <p>For security reasons, we recommend:</p>
              <ul>
                <li>Using a strong, unique password</li>
                <li>Not sharing your password with anyone</li>
                <li>Changing your password regularly</li>
              </ul>
              
              <p>If you have any questions or concerns, please contact our support team.</p>
              
              <p>Best regards,<br>The DriveBook Team</p>
            </div>
            <div class="footer">
              <p>This is an automated email. Please do not reply.</p>
              <p>&copy; ${new Date().getFullYear()} DriveBook. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
Password Reset Request

Hello,

We received a request to reset the password for your DriveBook account (${userName}).

Click the link below to reset your password:
${resetUrl}

This link will expire in 1 hour.

If you didn't request this reset, please ignore this email. Your password won't change until you create a new one.

Best regards,
The DriveBook Team
      `
    });
  }

  /**
   * Primary send function â€” all new code should use this.
   * Routes pass an event key; the registry resolves sender, replyTo, and category.
   *
   * @example
   *   await emailService.sendEmail({
   *     to: client.email,
   *     subject: `Booking Cancelled â€” ${dateStr}`,
   *     html,
   *     context: { event: 'BOOKING_CANCELLED' },
   *   })
   */
  async sendEmail({
    to,
    subject,
    html,
    context = {},
    replyTo,
  }: {
    to: string
    subject: string
    html: string
    context?: EmailContext
    replyTo?: string
  }): Promise<void> {
    const from = resolveSender(context)
    const resolvedReplyTo = replyTo ?? resolveReplyTo(context)

    await this.transporter.sendMail({
      from,
      to,
      subject,
      html,
      encoding: 'utf8',
      ...(resolvedReplyTo && { replyTo: resolvedReplyTo }),
    })
  }

  /**
   * Backward-compatible wrapper â€” existing callers continue to work unchanged.
   * Prefer sendEmail() with an event context for new code.
   */
  async sendGenericEmail({
    to,
    subject,
    html,
    from,
    event,
  }: {
    to: string
    subject: string
    html: string
    from?: string
    event?: EmailEvent
  }): Promise<void> {
    await this.sendEmail({
      to,
      subject,
      html,
      context: { from, event },
    })
  }


  /**
   * Send tax-compliant receipt email.
   * 
   * Sends receipts with proper sender resolution for white-label support,
   * event tracking, and error handling consistent with other email methods.
   * 
   * @param to - Recipient email address
   * @param subject - Email subject line
   * @param html - Pre-generated receipt HTML (from ReceiptTemplateEngine)
   * @param provider - Optional provider context for white-label sender resolution
   * @param replyTo - Optional reply-to address override
   * 
   * @example
   * await emailService.sendReceipt({
   *   to: customer.email,
   *   subject: 'Receipt DB-2024-ABC123 - Package Purchased',
   *   html: receiptHtml,
   *   provider: { id: providerId } // for white-label
   * });
   */
  async sendReceipt({
    to,
    subject,
    html,
    provider,
    replyTo,
  }: {
    to: string
    subject: string
    html: string
    provider?: DisplayIdentitySource
    replyTo?: string
  }): Promise<void> {
    // Use 'receipt' event for tracking and proper sender resolution
    await this.sendEmail({
      to,
      subject,
      html,
      context: {
        from: provider ? undefined : 'DriveBook Payments <payments@drivebook.com.au>',
        event: 'RECEIPT',
      },
      replyTo
    });
  }
  async sendWelcomeEmail(data: { customerName: string; customerEmail: string }) {
    const { customerName: customerName, customerEmail } = data;

    await this.transporter.sendMail({
      from: formatSender('team'),
      to: customerEmail,
      subject: 'Ã°Å¸Å½â€° Welcome to DriveBook - Your Account is Ready!',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
            .welcome-box { background: white; padding: 25px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #10b981; }
            .login-box { background: #eff6ff; padding: 20px; margin: 20px 0; border-radius: 8px; text-align: center; }
            .mobile-box { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #8b5cf6; }
            .feature-list { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; }
            .feature-list li { margin: 12px 0; padding-left: 10px; }
            .button { display: inline-block; background-color: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; margin: 10px 5px; font-weight: bold; font-size: 16px; }
            .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
            .credentials { background: #f3f4f6; padding: 15px; border-radius: 6px; margin: 15px 0; font-family: monospace; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0; font-size: 28px;">Ã°Å¸Å½â€° Welcome to DriveBook!</h1>
              <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Your journey starts here</p>
            </div>
            <div class="content">
              <div class="welcome-box">
                <h2 style="margin-top: 0; color: #1f2937;">Hi ${customerName}! Ã°Å¸â€˜â€¹</h2>
                <p style="font-size: 16px; margin: 15px 0;">
                  Your DriveBook account has been created successfully! You now have 24/7 access to manage your bookings, track your progress, and stay connected with your provider.
                </p>
              </div>

              <div class="login-box">
                <h3 style="margin-top: 0; color: #1f2937;">Ã°Å¸â€Â Your Login Credentials</h3>
                <div class="credentials">
                  <strong>Email:</strong> ${customerEmail}<br>
                  <strong>Password:</strong> (the one you just created)
                </div>
                <a href="${process.env.NEXTAUTH_URL}/login" class="button">Login to Dashboard</a>
              </div>

              <div class="feature-list">
                <h3 style="margin-top: 0; color: #1f2937;">Ã¢Å“Â¨ What You Can Do:</h3>
                <ul style="list-style: none; padding: 0;">
                  <li>Ã°Å¸â€œâ€¦ View and manage all your bookings</li>
                  <li>Ã°Å¸â€™Â° Track your wallet balance and packages</li>
                  <li>Ã°Å¸â€Â Book new lessons with your instructor</li>
                  <li>Ã¢Â­Â Leave reviews after your lessons</li>
                  <li>Ã°Å¸â€œÂ± Access everything from web or mobile app</li>
                  <li>Ã°Å¸â€â€ Get instant notifications about your lessons</li>
                </ul>
              </div>

              <div class="mobile-box">
                <h3 style="margin-top: 0; color: #1f2937;">Ã°Å¸â€œÂ± Download Our Mobile App</h3>
                <p style="margin: 15px 0;">
                  Get the DriveBook mobile app for easy access on the go! Manage your lessons, check your schedule, and stay connected with your instructor - all from your phone.
                </p>
                <p style="font-size: 14px; color: #6b7280; text-align: center; margin-top: 15px;">
                  Ã°Å¸â€™Â¡ <strong>Use the same login credentials</strong> (${customerEmail}) on the mobile app
                </p>
              </div>

              <div style="background: #fef3c7; padding: 20px; border-radius: 8px; border-left: 4px solid #f59e0b; margin: 20px 0;">
                <p style="margin: 0; color: #92400e;">
                  <strong>Ã°Å¸â€â€™ Keep Your Account Secure:</strong><br>
                  Never share your password with anyone. If you forget it, you can always reset it from the login page.
                </p>
              </div>

              <div style="text-align: center; margin: 30px 0;">
                <p style="font-size: 18px; color: #1f2937; margin-bottom: 15px;">
                  <strong>Ready to get started?</strong>
                </p>
                <a href="${process.env.NEXTAUTH_URL}/login" class="button">Access Your Dashboard</a>
              </div>

              <p style="text-align: center; color: #6b7280; margin: 20px 0;">
                Need help? Contact your instructor or visit our help center.
              </p>
              
              <div class="footer">
                <p><strong>DriveBook</strong> - Your Driving Instructor Platform</p>
                <p style="font-size: 12px; color: #9ca3af; margin-top: 10px;">
                  This email was sent because an account was created with this email address.
                </p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `
    });
  }
  /**
   * Day-1 instructor setup nudge.
   * Sent ~24h after registration if the instructor hasn't completed all 5 setup steps.
   * Each step shows Ã¢Å“â€¦ (done) or Ã°Å¸â€Â² (to do) based on actual DB state.
   */
  /**
   * Day-1 instructor setup nudge.
   * Sent ~24h after registration if the instructor has not completed all 5 setup steps.
   * Template is in lib/email/setup-nudge-template.ts  uses HTML entities, no raw Unicode.
   */
  async sendInstructorSetupEmail(data: {
    instructorName: string
    instructorEmail: string
    steps: {
      documentsUploaded: boolean
      rateAndAreaSet: boolean
      availabilitySet: boolean
      bioComplete: boolean
      stripeConnected: boolean
    }
  }) {
    const { buildSetupNudgeEmail } = await import('@/lib/email/setup-nudge-template')
    const { subject, html } = buildSetupNudgeEmail({
      instructorName: data.instructorName,
      steps: data.steps,
      baseUrl: process.env.NEXTAUTH_URL || 'https://drivebook.com.au',
      supportEmail: process.env.ADMIN_EMAIL || 'support@drivebook.com.au',
    })
    await this.transporter.sendMail({
      from: formatSender('team'),
      to: data.instructorEmail,
      subject,
      html,
      encoding: 'utf8',
    })
  }

  async sendClaimAccountEmail(data: {
    customerName: string
    customerEmail: string
    instructorName: string
    provider?: DisplayIdentitySource  // If provided, use getDisplayName() for white-label support
    lessonDate: Date
    claimUrl: string
    timezone?: string
  }) {
    const { customerName: customerName, customerEmail, instructorName, lessonDate, claimUrl } = data
    const tz = resolveTimezone(data.timezone ?? DEFAULT_TIMEZONE)
    const providerName = data.provider ? getDisplayName(data.provider) : instructorName
    const dateStr = lessonDate.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: tz })
    const timeStr = formatLocalTime(lessonDate, tz, { hour: '2-digit', minute: '2-digit' })

    await this.transporter.sendMail({
      from: formatSender('team'),
      to: customerEmail,
      subject: `Ã°Å¸â€œâ€¦ ${providerName} booked a lesson for you Ã¢â‚¬â€ claim your account`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
            .lesson-box { background: white; padding: 25px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #10b981; }
            .cta-box { background: #eff6ff; padding: 25px; margin: 20px 0; border-radius: 8px; text-align: center; }
            .button { display: inline-block; background-color: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; }
            .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0; font-size: 26px;">Ã°Å¸â€œâ€¦ Lesson Booked for You</h1>
              <p style="margin: 10px 0 0 0; opacity: 0.9;">Your instructor scheduled a lesson on DriveBook</p>
            </div>
            <div class="content">
              <p>Hi ${customerName},</p>
              <p><strong>${providerName}</strong> has made a booking for you.</p>

              <div class="lesson-box">
                <h3 style="margin-top: 0; color: #1f2937;">Ã°Å¸â€œâ€¦ Your Lesson Details</h3>
                <p style="margin: 5px 0;"><strong>Date:</strong> ${dateStr}</p>
                <p style="margin: 5px 0;"><strong>Time:</strong> ${timeStr}</p>
                <p style="margin: 5px 0;"><strong>Instructor:</strong> ${providerName}</p>
              </div>

              <div class="cta-box">
                <h3 style="margin-top: 0; color: #1f2937;">Ã°Å¸â€Â Claim Your Account</h3>
                <p>Set up your DriveBook account to view your booking, track your progress, and manage future lessons.</p>
                <a href="${claimUrl}" class="button">Claim My Account Ã¢â€ â€™</a>
                <p style="font-size: 12px; color: #6b7280; margin-top: 15px;">This link expires in 7 days.</p>
              </div>

              <p style="color: #6b7280; font-size: 14px;">
                If you weren't expecting this email, you can ignore it Ã¢â‚¬â€ no account will be created unless you click the link above.
              </p>

              <div class="footer">
                <p><strong>DriveBook</strong> Ã¢â‚¬â€ Your Driving Instructor Platform</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `
    })
  }

  /**
   * PKG-4: Package Cancellation Workflow Email Notifications
   */

  async sendCancellationRequestedEmail(data: {
    customerName: string
    customerEmail: string
    instructorName: string
    packageHours: number
    hoursUsed: number
    calculatedRefund: number
    bookingId: string
  }) {
    const { customerName, customerEmail, instructorName, packageHours, hoursUsed, calculatedRefund, bookingId } = data

    await this.transporter.sendMail({
      from: formatSender('bookings'),
      to: customerEmail,
      subject: 'Cancellation Request Received - Under Review',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
            .info-box { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #f59e0b; }
            .info-row { margin: 10px 0; }
            .label { font-weight: bold; color: #1f2937; }
            .notice { background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b; }
            .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0;">Cancellation Request Received</h1>
            </div>
            <div class="content">
              <p>Hi ${customerName},</p>
              <p>We've received your request to cancel your package booking with <strong>${instructorName}</strong>.</p>
              
              <div class="info-box">
                <h3 style="margin-top: 0; color: #1f2937;">Package Details:</h3>
                <div class="info-row">
                  <span class="label">Package:</span> ${packageHours} hours
                </div>
                <div class="info-row">
                  <span class="label">Hours Used:</span> ${hoursUsed} hours
                </div>
                <div class="info-row">
                  <span class="label">Hours Remaining:</span> ${packageHours - hoursUsed} hours
                </div>
                <div class="info-row">
                  <span class="label">Estimated Refund:</span> <strong style="color: #10b981; font-size: 18px;">$${calculatedRefund.toFixed(2)}</strong>
                </div>
              </div>

              <div class="notice">
                <p style="margin: 0;"><strong>What Happens Next:</strong></p>
                <ul style="margin: 10px 0; padding-left: 20px;">
                  <li>Our team will review your request within 24 hours</li>
                  <li>We'll verify the refund calculation based on hours used</li>
                  <li>You'll receive an email once the review is complete</li>
                  <li>If approved, the refund will be issued to your original payment method</li>
                </ul>
              </div>

              <p style="color: #6b7280; font-size: 14px;">
                <strong>Note:</strong> Your booking remains active until the cancellation is approved.
              </p>

              <div class="footer">
                <p><strong>Reference ID:</strong> ${bookingId}</p>
                <p>DriveBook Support Team</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `
    })
  }

  async sendCancellationPendingAdminEmail(data: {
    adminEmail: string
    customerName: string
    instructorName: string
    packageHours: number
    hoursUsed: number
    calculatedRefund: number
    cancellationReason?: string
    bookingId: string
  }) {
    const { adminEmail, customerName, instructorName, packageHours, hoursUsed, calculatedRefund, cancellationReason, bookingId } = data

    await this.transporter.sendMail({
      from: formatSender('support'),
      to: adminEmail,
      subject: `New Cancellation Request - ${customerName} ($${calculatedRefund.toFixed(2)})`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
            .info-box { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #ef4444; }
            .info-row { margin: 10px 0; }
            .label { font-weight: bold; color: #1f2937; }
            .button { display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 5px; font-weight: bold; }
            .urgent { background: #fee2e2; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ef4444; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0;">New Cancellation Pending Review</h1>
            </div>
            <div class="content">
              <div class="urgent">
                <p style="margin: 0; font-size: 16px;"><strong>Action Required:</strong> A package cancellation request requires admin approval.</p>
              </div>

              <div class="info-box">
                <h3 style="margin-top: 0; color: #1f2937;">Cancellation Details:</h3>
                <div class="info-row">
                  <span class="label">Customer:</span> ${customerName}
                </div>
                <div class="info-row">
                  <span class="label">Instructor:</span> ${instructorName}
                </div>
                <div class="info-row">
                  <span class="label">Package:</span> ${packageHours} hours (${hoursUsed} used, ${packageHours - hoursUsed} remaining)
                </div>
                <div class="info-row">
                  <span class="label">Calculated Refund:</span> <strong style="color: #10b981; font-size: 18px;">$${calculatedRefund.toFixed(2)}</strong>
                </div>
                ${cancellationReason ? `
                <div class="info-row" style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e5e7eb;">
                  <span class="label">Customer Reason:</span><br>
                  <em style="color: #6b7280;">"${cancellationReason}"</em>
                </div>
                ` : ''}
              </div>

              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.NEXTAUTH_URL}/admin/cancellations" class="button">Review in Admin Dashboard</a>
              </div>

              <p style="color: #6b7280; font-size: 14px;">
                <strong>Booking ID:</strong> ${bookingId}
              </p>
            </div>
          </div>
        </body>
        </html>
      `
    })
  }

  async sendCancellationApprovedEmail(data: {
    customerName: string
    customerEmail: string
    instructorName: string
    refundAmount: number
    stripeRefundId: string
    adminNote?: string
  }) {
    const { customerName, customerEmail, instructorName, refundAmount, stripeRefundId, adminNote } = data

    await this.transporter.sendMail({
      from: formatSender('bookings'),
      to: customerEmail,
      subject: 'Cancellation Approved - Refund Issued',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
            .success-box { background: #d1fae5; padding: 25px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #10b981; text-align: center; }
            .info-box { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #10b981; }
            .info-row { margin: 10px 0; }
            .label { font-weight: bold; color: #1f2937; }
            .timeline { background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0;">Cancellation Approved</h1>
              <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Your refund has been processed</p>
            </div>
            <div class="content">
              <p>Hi ${customerName},</p>
              <p>Your cancellation request has been approved, and your refund has been processed.</p>
              
              <div class="success-box">
                <h2 style="margin: 0; color: #10b981; font-size: 32px;">$${refundAmount.toFixed(2)}</h2>
                <p style="margin: 10px 0 0 0; color: #065f46; font-size: 14px;">Refunded to your original payment method</p>
              </div>

              <div class="info-box">
                <div class="info-row">
                  <span class="label">Package Cancelled:</span> ${instructorName}
                </div>
                <div class="info-row">
                  <span class="label">Refund Amount:</span> $${refundAmount.toFixed(2)}
                </div>
                ${adminNote ? `
                <div class="info-row" style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e5e7eb;">
                  <span class="label">Note from our team:</span><br>
                  <em style="color: #6b7280;">${adminNote}</em>
                </div>
                ` : ''}
              </div>

              <div class="timeline">
                <p style="margin: 0 0 10px 0; font-weight: bold; color: #1f2937;">What to Expect:</p>
                <ul style="margin: 0; padding-left: 20px; color: #6b7280;">
                  <li>Refund initiated immediately</li>
                  <li>Processing time: 5-10 business days</li>
                  <li>The refund will appear on your card statement</li>
                </ul>
              </div>

              <div class="footer">
                <p><strong>Reference ID:</strong> ${stripeRefundId}</p>
                <p>Thank you for using DriveBook</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `
    })
  }

  async sendCancellationRejectedEmail(data: {
    customerName: string
    customerEmail: string
    instructorName: string
    rejectionReason: string
    bookingId: string
  }) {
    const { customerName, customerEmail, instructorName, rejectionReason, bookingId } = data

    await this.transporter.sendMail({
      from: formatSender('bookings'),
      to: customerEmail,
      subject: 'Cancellation Request Update',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
            .info-box { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #6b7280; }
            .reason-box { background: #fef3c7; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #f59e0b; }
            .button { display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0; font-weight: bold; }
            .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0;">Cancellation Request Update</h1>
            </div>
            <div class="content">
              <p>Hi ${customerName},</p>
              <p>We've reviewed your cancellation request for your package booking with <strong>${instructorName}</strong>.</p>

              <div class="reason-box">
                <p style="margin: 0 0 10px 0; font-weight: bold; color: #92400e;">About Your Request:</p>
                <p style="margin: 0; color: #78350f;">${rejectionReason}</p>
              </div>

              <div class="info-box">
                <p style="margin: 0;"><strong>Your Booking Status:</strong></p>
                <ul style="margin: 10px 0; padding-left: 20px;">
                  <li>Your booking remains <strong>active</strong></li>
                  <li>No changes have been made to your package</li>
                  <li>You can continue using your remaining hours</li>
                </ul>
              </div>

              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.NEXTAUTH_URL}/login" class="button">View Your Dashboard</a>
              </div>

              <div class="footer">
                <p><strong>Booking ID:</strong> ${bookingId}</p>
                <p>Need help? Reply to this email or contact support.</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `
    })
  }
}
// Export EmailService class and singleton instance
export default EmailService;
export const emailService = new EmailService();