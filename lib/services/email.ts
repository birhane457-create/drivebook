import nodemailer from 'nodemailer'
import { resolveTimezone, timezoneFromState, formatLocalDate, formatLocalTime, DEFAULT_TIMEZONE } from '@/lib/utils/timezone'
import { formatSender } from '@/lib/email/senders'
import { EMAIL_EVENTS, type EmailEvent } from '@/lib/email/registry'
import { type EmailContext, resolveSender, resolveReplyTo } from '@/lib/email/context'

interface BookingConfirmationData {
  clientName: string
  clientEmail: string
  clientPhone?: string
  instructorName: string
  instructorEmail: string
  instructorPhone?: string
  startTime: Date
  endTime: Date
  pickupAddress?: string
  timezone?: string  // instructor's timezone â€” defaults to Perth for backward compatibility
}

interface PDATestReminderData {
  clientName: string
  clientEmail: string
  instructorName: string
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
    const { clientName, clientEmail, clientPhone, instructorName, instructorEmail, instructorPhone, startTime, endTime, pickupAddress } = data
    const tz = resolveTimezone(data.timezone ?? DEFAULT_TIMEZONE)

    // Email to client
    await this.transporter.sendMail({
      from: formatSender('bookings'),
      to: clientEmail,
      subject: 'Driving Lesson Confirmed âœ“',
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
              <h1 style="margin: 0;">ðŸš— Lesson Confirmed!</h1>
            </div>
            <div class="content">
              <p>Hi ${clientName},</p>
              <p>Great news! Your driving lesson with <strong>${instructorName}</strong> has been confirmed.</p>
              
              <div class="info-box">
                <div class="info-row">
                  <span class="label">ðŸ“… Date:</span> ${formatLocalDate(startTime, tz)}
                </div>
                <div class="info-row">
                  <span class="label">ðŸ• Time:</span> ${formatLocalTime(startTime, tz, { hour: '2-digit', minute: '2-digit' })} - ${formatLocalTime(endTime, tz, { hour: '2-digit', minute: '2-digit' })}
                </div>
                ${pickupAddress ? `
                <div class="info-row">
                  <span class="label">ðŸ“ Pickup:</span> ${pickupAddress}
                </div>
                ` : ''}
              </div>

              <div class="instructor-box">
                <div class="info-row">
                  <span class="label">ðŸ‘¨â€ðŸ« Your Instructor: ${instructorName}</span>
                </div>
                ${instructorPhone ? `
                <div class="info-row">
                  <span class="label">ðŸ“± Phone:</span> <a href="tel:${instructorPhone}">${instructorPhone}</a>
                </div>
                ` : ''}
                <div class="info-row">
                  <span class="label">ðŸ“§ Email:</span> <a href="mailto:${instructorEmail}">${instructorEmail}</a>
                </div>
              </div>

              <div class="dashboard-box">
                <strong>ðŸ“± Manage Your Bookings Anytime</strong>
                <p style="margin: 10px 0;">Access your dashboard to view, reschedule, or manage all your lessons:</p>
                <div style="text-align: center;">
                  <a href="${process.env.NEXTAUTH_URL}/login" class="button">Login to Dashboard</a>
                </div>
                <p style="margin: 10px 0; font-size: 14px; color: #6b7280;">
                  ðŸ’¡ <strong>Tip:</strong> Download our mobile app for easy access on the go!
                </p>
              </div>
              
              <div class="next-steps">
                <strong>ðŸ“‹ What to expect:</strong>
                <ul style="margin: 0; padding-left: 20px;">
                  <li>Be ready 5-10 minutes before your scheduled time</li>
                  <li>Your instructor will contact you with final location details if needed</li>
                  <li>Bring any required documents (license, insurance, etc.)</li>
                  <li>If you need to reschedule or cancel, please contact your instructor as soon as possible</li>
                </ul>
              </div>
              
              <p>See you soon!</p>
              
              <div class="footer">
                <p>DriveBook - Your Driving Instructor Platform</p>
                <p style="font-size: 12px; color: #9ca3af;">
                  Login: ${clientEmail}
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
      subject: `New Booking: ${clientName}`,
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
              <h1 style="margin: 0;">ðŸ“‹ New Booking Received</h1>
            </div>
            <div class="content">
              <p>You have a new booking from <strong>${clientName}</strong></p>
              
              <div class="info-box">
                <div class="info-row">
                </div>
                <div class="info-row">
                  <span class="label">ðŸ• Time:</span> ${formatLocalTime(startTime, tz, { hour: '2-digit', minute: '2-digit' })} - ${formatLocalTime(endTime, tz, { hour: '2-digit', minute: '2-digit' })}
                </div>
                ${pickupAddress ? `
                <div class="info-row">
                  <span class="label">ðŸ“ Pickup:</span> ${pickupAddress}
                </div>
                ` : ''}
                <div class="info-row">
                  <span class="label">ðŸ“§ Client Email:</span> ${clientEmail}
                </div>
                ${clientPhone ? `
                <div class="info-row">
                  <span class="label">ðŸ“± Client Phone:</span> <a href="tel:${clientPhone}">${clientPhone}</a>
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
    const { clientName, clientEmail, instructorName, testDate, testTime, testCenter } = data
    const tz = resolveTimezone(data.timezone ?? DEFAULT_TIMEZONE)

    await this.transporter.sendMail({
      from: formatSender('bookings'),
      to: clientEmail,
      subject: 'ðŸŽ¯ Driving Test Tomorrow - Good Luck!',
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
              <h1 style="margin: 0;">ðŸŽ¯ Your Driving Test is Tomorrow!</h1>
            </div>
            <div class="content">
              <p>Hi ${clientName},</p>
              <p>This is a friendly reminder that your PDA driving test is scheduled for tomorrow. You've got this!</p>
              
              <div class="info-box">
                <div class="info-row">
                  <span class="label">ðŸ“… Date:</span> ${formatLocalDate(testDate, tz)}
                </div>
                <div class="info-row">
                  <span class="label">ðŸ• Time:</span> ${testTime}
                </div>
                <div class="info-row">
                  <span class="label">ðŸ“ Location:</span> ${testCenter}
                </div>
                <div class="info-row">
                  <span class="label">ðŸ‘¨â€ðŸ« Instructor:</span> ${instructorName}
                </div>
              </div>
              
              <div class="tips">
                <strong>ðŸ“ Quick Tips:</strong>
                <ul>
                  <li>Get a good night's sleep</li>
                  <li>Arrive 15 minutes early</li>
                  <li>Bring your learner's permit and ID</li>
                  <li>Stay calm and drive as you've practiced</li>
                  <li>Remember to check your mirrors regularly</li>
                </ul>
              </div>
              
              <p>${instructorName} will meet you there. Good luck - you're going to do great!</p>
              
              <p style="text-align: center; font-size: 24px; margin: 20px 0;">ðŸ€ Good Luck! ðŸ€</p>
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
              <h1>ðŸ” Password Reset Request</h1>
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
                <strong>âš ï¸ Important:</strong>
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
   * Primary send function — all new code should use this.
   * Routes pass an event key; the registry resolves sender, replyTo, and category.
   *
   * @example
   *   await emailService.sendEmail({
   *     to: client.email,
   *     subject: `Booking Cancelled — ${dateStr}`,
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
   * Backward-compatible wrapper — existing callers continue to work unchanged.
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

  async sendWelcomeEmail(data: { clientName: string; clientEmail: string }) {
    const { clientName, clientEmail } = data;

    await this.transporter.sendMail({
      from: formatSender('team'),
      to: clientEmail,
      subject: 'ðŸŽ‰ Welcome to DriveBook - Your Account is Ready!',
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
              <h1 style="margin: 0; font-size: 28px;">ðŸŽ‰ Welcome to DriveBook!</h1>
              <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Your journey starts here</p>
            </div>
            <div class="content">
              <div class="welcome-box">
                <h2 style="margin-top: 0; color: #1f2937;">Hi ${clientName}! ðŸ‘‹</h2>
                <p style="font-size: 16px; margin: 15px 0;">
                  Your DriveBook account has been created successfully! You now have 24/7 access to manage your driving lessons, track your progress, and stay connected with your instructor.
                </p>
              </div>

              <div class="login-box">
                <h3 style="margin-top: 0; color: #1f2937;">ðŸ” Your Login Credentials</h3>
                <div class="credentials">
                  <strong>Email:</strong> ${clientEmail}<br>
                  <strong>Password:</strong> (the one you just created)
                </div>
                <a href="${process.env.NEXTAUTH_URL}/login" class="button">Login to Dashboard</a>
              </div>

              <div class="feature-list">
                <h3 style="margin-top: 0; color: #1f2937;">âœ¨ What You Can Do:</h3>
                <ul style="list-style: none; padding: 0;">
                  <li>ðŸ“… View and manage all your bookings</li>
                  <li>ðŸ’° Track your wallet balance and packages</li>
                  <li>ðŸ” Book new lessons with your instructor</li>
                  <li>â­ Leave reviews after your lessons</li>
                  <li>ðŸ“± Access everything from web or mobile app</li>
                  <li>ðŸ”” Get instant notifications about your lessons</li>
                </ul>
              </div>

              <div class="mobile-box">
                <h3 style="margin-top: 0; color: #1f2937;">ðŸ“± Download Our Mobile App</h3>
                <p style="margin: 15px 0;">
                  Get the DriveBook mobile app for easy access on the go! Manage your lessons, check your schedule, and stay connected with your instructor - all from your phone.
                </p>
                <p style="font-size: 14px; color: #6b7280; text-align: center; margin-top: 15px;">
                  ðŸ’¡ <strong>Use the same login credentials</strong> (${clientEmail}) on the mobile app
                </p>
              </div>

              <div style="background: #fef3c7; padding: 20px; border-radius: 8px; border-left: 4px solid #f59e0b; margin: 20px 0;">
                <p style="margin: 0; color: #92400e;">
                  <strong>ðŸ”’ Keep Your Account Secure:</strong><br>
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
   * Each step shows âœ… (done) or ðŸ”² (to do) based on actual DB state.
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
    clientName: string
    clientEmail: string
    instructorName: string
    lessonDate: Date
    claimUrl: string
    timezone?: string
  }) {
    const { clientName, clientEmail, instructorName, lessonDate, claimUrl } = data
    const tz = resolveTimezone(data.timezone ?? DEFAULT_TIMEZONE)
    const dateStr = lessonDate.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: tz })
    const timeStr = formatLocalTime(lessonDate, tz, { hour: '2-digit', minute: '2-digit' })

    await this.transporter.sendMail({
      from: formatSender('team'),
      to: clientEmail,
      subject: `ðŸ“… ${instructorName} booked a lesson for you â€” claim your account`,
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
              <h1 style="margin: 0; font-size: 26px;">ðŸ“… Lesson Booked for You</h1>
              <p style="margin: 10px 0 0 0; opacity: 0.9;">Your instructor scheduled a lesson on DriveBook</p>
            </div>
            <div class="content">
              <p>Hi ${clientName},</p>
              <p><strong>${instructorName}</strong> has booked a driving lesson for you on DriveBook.</p>

              <div class="lesson-box">
                <h3 style="margin-top: 0; color: #1f2937;">ðŸ“… Your Lesson Details</h3>
                <p style="margin: 5px 0;"><strong>Date:</strong> ${dateStr}</p>
                <p style="margin: 5px 0;"><strong>Time:</strong> ${timeStr}</p>
                <p style="margin: 5px 0;"><strong>Instructor:</strong> ${instructorName}</p>
              </div>

              <div class="cta-box">
                <h3 style="margin-top: 0; color: #1f2937;">ðŸ” Claim Your Account</h3>
                <p>Set up your DriveBook account to view your booking, track your progress, and manage future lessons.</p>
                <a href="${claimUrl}" class="button">Claim My Account â†’</a>
                <p style="font-size: 12px; color: #6b7280; margin-top: 15px;">This link expires in 7 days.</p>
              </div>

              <p style="color: #6b7280; font-size: 14px;">
                If you weren't expecting this email, you can ignore it â€” no account will be created unless you click the link above.
              </p>

              <div class="footer">
                <p><strong>DriveBook</strong> â€” Your Driving Instructor Platform</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `
    })
  }
}

export const emailService = new EmailService()
