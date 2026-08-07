import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { emailService } from '@/lib/services/email'
import crypto from 'crypto'
// P1-4 FIX: Rate limit registration — prevents email enumeration and DB flooding
import { checkRateLimitStrict, getRateLimitIdentifier, authRateLimit } from '@/lib/ratelimit'
import { normalizeEmail } from '@/lib/auth-email'


export const dynamic = 'force-dynamic';
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2),
  // P1-5 FIX: Validate phone format — rejects empty strings, SQL-adjacent values, and 1000-char inputs
  phone: z.string()
    .transform(s => s.replace(/\s+/g, ''))
    .refine(p => /^\+?\d{9,15}$/.test(p), 'Invalid phone number'),
  // Signup-time fields are now optional — instructors complete these in the dashboard
  baseAddress: z.string().optional().default(''),
  hourlyRate: z.number().optional().default(65),
  vehicleTypes: z.array(z.enum(['AUTO', 'MANUAL'])).optional().default(['AUTO']),
  serviceRadiusKm: z.number().optional().default(20),
  licenseNumber: z.string().optional(),
  insuranceNumber: z.string().optional(),
  termsAccepted: z.boolean().optional(),
  ageDeclaration: z.boolean().optional(),
  termsVersion: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    // P1-4 FIX: Rate limit by IP — 5 registrations per 15 minutes prevents email
    // enumeration (via "Email already registered" error) and DB flooding
    const ip = req.headers.get('x-forwarded-for') || 'unknown';
    const rateLimitId = getRateLimitIdentifier(undefined, ip, 'register');
    const rateLimitResult = await checkRateLimitStrict(authRateLimit, rateLimitId);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many registration attempts. Please try again later.' },
        { status: 429, headers: rateLimitResult.headers }
      );
    }

    const body = await req.json()
    const data = registerSchema.parse(body)

    const normalizedEmail = normalizeEmail(data.email)

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 400 }
      )
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(data.password, 10)

    // Create verification token (instructor-only)
    const verificationToken = crypto.randomBytes(32).toString('hex')
    const verificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000)

    // Create user and instructor
    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        password: hashedPassword,
        role: 'INSTRUCTOR',
        emailVerified: false,
        verificationToken,
        verificationTokenExpiry,
        ...(data.termsAccepted && {
          termsAcceptedAt: new Date(),
          termsVersion: data.termsVersion || '1.0',
          ageDeclaration: data.ageDeclaration ?? false,
        }),
        instructor: {
          create: {
            name: data.name,
            phone: data.phone,
            baseAddress: data.baseAddress ?? '',
            hourlyRate: data.hourlyRate ?? 65,
            vehicleTypes: (data.vehicleTypes ?? ['AUTO']).join(','),
            serviceRadiusKm: data.serviceRadiusKm ?? 20,
            languages: 'English',
            ...(data.licenseNumber && { licenseNumber: data.licenseNumber }),
            ...(data.insuranceNumber && { insuranceNumber: data.insuranceNumber }),
            approvalStatus: 'PENDING',
            isActive: false
          }
        }
      },
      include: {
        instructor: true
      }
    })

    // Update user with instructorId and start 14-day trial immediately
    if (user.instructor) {
      // Fix 4: Trial length from config — easy to change without redeploying
      const trialDays = Number(process.env.BASIC_TRIAL_DAYS) || 14
      const trialEndsAt = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000)

      await prisma.user.update({
        where: { id: user.id },
        data: { instructorId: user.instructor.id }
      })

      // Fix 1: Atomic trial creation inside a transaction — prevents duplicate subscriptions
      // if two concurrent requests somehow register the same instructor simultaneously
      await prisma.$transaction(async (tx) => {
        // Start trial on the instructor record
        await tx.instructor.update({
          where: { id: user.instructor!.id },
          data: {
            subscriptionTier: 'BASIC',
            subscriptionStatus: 'TRIAL',
            trialEndsAt,
          }
        })
        // Create the Subscription row so the subscription page can show billing info
        await tx.subscription.create({
          data: {
            instructorId: user.instructor!.id,
            tier: 'BASIC',
            status: 'TRIAL',
            monthlyAmount: 0,
            billingCycle: 'monthly',
            currentPeriodStart: new Date(),
            currentPeriodEnd: trialEndsAt,
            trialEndsAt,
          }
        })
      })
    }

    // Send welcome email to instructor
    try {
      const instructorData = user.instructor;
      if (instructorData) {
        const verifyUrl = `${process.env.NEXTAUTH_URL}/api/auth/verify-email?token=${verificationToken}`

        await emailService.sendGenericEmail({
          from: 'DriveBook Account Verification <verification@drivebook.com.au>',
          to: user.email,
          subject: `Welcome to ${process.env.PLATFORM_NAME || 'DriveBook'}! Please verify your email`,
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
              .button { display: inline-block; background: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
              .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="margin: 0;">🎉 Welcome to ${process.env.PLATFORM_NAME || 'DriveBook'}!</h1>
              </div>
              <div class="content">
                <p>Hi ${instructorData.name},</p>
                <p>Thank you for registering as a driving instructor on our platform!</p>

                <div class="info-box">
                  <h3 style="margin-top: 0;">✅ Verify Your Email</h3>
                  <p style="margin: 10px 0;">Please verify your email to access the instructor dashboard.</p>
                  <div style="text-align: center;">
                    <a href="${verifyUrl}" class="button">Verify Email →</a>
                  </div>
                  <p style="margin: 10px 0 0 0; font-size: 13px; color: #6b7280;">This link expires in 24 hours.</p>
                </div>
                
                <div class="info-box">
                  <h3 style="margin-top: 0;">📋 What's Next?</h3>
                  <ol>
                    <li><strong>Account Review:</strong> Our team will review your application within 24-48 hours</li>
                    <li><strong>Complete Profile:</strong> While you wait, you can complete your profile</li>
                    <li><strong>Upload Documents:</strong> Add your license, insurance, and certifications</li>
                    <li><strong>Set Availability:</strong> Configure your working hours and service areas</li>
                  </ol>
                </div>
                
                <p>Once approved, you'll be able to:</p>
                <ul>
                  <li>✅ Accept bookings from students</li>
                  <li>✅ Manage your schedule</li>
                  <li>✅ Track your earnings</li>
                  <li>✅ Sync with Google Calendar</li>
                  <li>✅ Access our mobile app</li>
                </ul>
                
                <div style="text-align: center;">
                  <a href="${process.env.NEXTAUTH_URL}/setup" class="button">Complete Your Profile</a>
                </div>
                
                <p>We'll notify you as soon as your account is approved!</p>
                
                <p>If you have any questions, feel free to reach out to us at ${process.env.ADMIN_EMAIL || 'support@drivebook.com'}</p>
                
                <p>Best regards,<br>The ${process.env.PLATFORM_NAME || 'DriveBook'} Team</p>
                
                <div class="footer">
                  <p>${process.env.PLATFORM_NAME || 'DriveBook'} - Your Driving Instructor Platform</p>
                </div>
              </div>
            </div>
          </body>
          </html>
        `
        });
      }
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError);
      // Don't fail registration if email fails
    }

    // Notify admin of new registration
    try {
      const instructorData = user.instructor;
      if (instructorData) {
        await emailService.sendGenericEmail({
          from: 'DriveBook Support <support@drivebook.com.au>',
          to: process.env.ADMIN_EMAIL || 'admin@drivebook.com',
          subject: '🆕 New Instructor Registration',
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
              .info-row { margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
              .label { font-weight: bold; color: #1f2937; display: inline-block; width: 120px; }
              .button { display: inline-block; background: #10b981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="margin: 0;">🆕 New Instructor Registration</h1>
              </div>
              <div class="content">
                <p>A new instructor has registered and is awaiting approval.</p>
                
                <div class="info-box">
                  <h3 style="margin-top: 0;">Instructor Details:</h3>
                  <div class="info-row">
                    <span class="label">Name:</span> <strong>${instructorData.name}</strong>
                  </div>
                  <div class="info-row">
                    <span class="label">Email:</span> ${user.email}
                  </div>
                  <div class="info-row">
                    <span class="label">Phone:</span> ****${instructorData.phone.slice(-4)}
                  </div>
                  <div class="info-row">
                    <span class="label">Location:</span> ${instructorData.baseAddress}
                  </div>
                  <div class="info-row">
                    <span class="label">Hourly Rate:</span> [see dashboard]
                  </div>
                  <div class="info-row">
                    <span class="label">Vehicle Types:</span> ${instructorData.vehicleTypes || 'N/A'}
                  </div>
                  <div class="info-row">
                    <span class="label">Registered:</span> ${new Date().toLocaleString()}
                  </div>
                </div>
                
                <p><strong>Action Required:</strong> Please review and approve/reject this application.</p>
                
                <div style="text-align: center;">
                  <a href="${process.env.NEXTAUTH_URL}/admin/instructors" class="button">Review Application</a>
                </div>
                
                <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
                  This is an automated notification from ${process.env.PLATFORM_NAME || 'DriveBook'}.
                </p>
              </div>
            </div>
          </body>
          </html>
        `
        });
      }
    } catch (emailError) {
      console.error('Failed to send admin notification:', emailError);
      // Don't fail registration if email fails
    }

    return NextResponse.json(
      { 
        message: 'Registration successful. Please verify your email then log in.',
        userId: user.id,
        status: 'pending_approval',
        redirectTo: '/login'
      },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    console.error('Registration error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
