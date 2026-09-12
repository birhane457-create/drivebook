import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { emailService } from '@/lib/services/email'
import crypto from 'crypto'
// P1-4 FIX: Rate limit registration — prevents email enumeration and DB flooding
import { checkRateLimitStrict, getRateLimitIdentifier, authRateLimit } from '@/lib/ratelimit'
import { normalizeEmail } from '@/lib/auth-email'
import { loadTemplateConfig, createBusinessFromTemplate } from '@/lib/presets/loader'


export const dynamic = 'force-dynamic';
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2),
  // P1-5 FIX: Validate phone format — rejects empty strings, SQL-adjacent values, and 1000-char inputs
  phone: z.string()
    .transform(s => s.replace(/\s+/g, ''))
    .refine(p => /^\+?\d{9,15}$/.test(p), 'Invalid phone number'),
  // Business type — determines which template to use
  businessType: z.enum(['driving', 'plumber', 'electrician', 'beauty', 'tax']).optional().default('driving'),
  // Signup-time fields are now optional — providers complete these in the dashboard
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

    // Create verification token
    const verificationToken = crypto.randomBytes(32).toString('hex')
    const verificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000)

    // Load template config for the selected business type
    const templateConfig = await loadTemplateConfig(data.businessType)
    
    if (!templateConfig) {
      return NextResponse.json(
        { error: `Template not found for business type: ${data.businessType}` },
        { status: 400 }
      )
    }

    // Derive businessModel and paymentMode from business type (architecture rule)
    // Driving = MARKETPLACE (platform operates discovery + payments)
    // Everything else = SAAS (provider brings own clients, pays subscription)
    const businessModel = data.businessType === 'driving' ? 'MARKETPLACE' : 'SAAS'
    const paymentMode   = data.businessType === 'driving' ? 'PLATFORM'    : 'DIRECT'

    // Create user, provider, and business in a transaction (15s timeout for Business template creation)
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create User
      const user = await tx.user.create({
        data: {
          email: normalizedEmail,
          password: hashedPassword,
          role: 'provider',
          emailVerified: false,
          verificationToken,
          verificationTokenExpiry,
          ...(data.termsAccepted && {
            termsAcceptedAt: new Date(),
            termsVersion: data.termsVersion || '1.0',
            ageDeclaration: data.ageDeclaration ?? false,
          }),
        },
      })

      // 2. Create Provider
      const provider = await tx.provider.create({
        data: {
          user: {
            connect: { id: user.id }
          },
          name: data.name,
          phone: data.phone,
          businessModel,
          paymentMode,
          accountType: 'INDIVIDUAL',
          hourlyRate: data.hourlyRate ?? 65,
          baseAddress: data.baseAddress ?? '',
          serviceRadiusKm: data.serviceRadiusKm ?? 20,
          languages: 'English',
          approvalStatus: 'PENDING',
          isActive: false,
        },
      })

      // 3. Link user to provider
      await tx.user.update({
        where: { id: user.id },
        data: { providerId: provider.id },
      })

      // 4. Start trial subscription
      const trialDays = Number(process.env.BASIC_TRIAL_DAYS) || 14
      const trialEndsAt = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000)

      await tx.provider.update({
        where: { id: provider.id },
        data: {
          subscriptionTier: 'BASIC',
          subscriptionStatus: 'TRIAL',
          trialEndsAt,
        },
      })

      await tx.subscription.create({
        data: {
          provider: { connect: { id: provider.id } },
          tier: 'BASIC',
          status: 'TRIAL',
          monthlyAmount: 0,
          billingCycle: 'monthly',
          currentPeriodStart: new Date(),
          currentPeriodEnd: trialEndsAt,
          trialEndsAt,
        },
      })

      return { user, provider }
    }, {
      timeout: 10000, // Lean transaction — no template creation here
    })

    const { user, provider } = result

    // 5. Create Business + Business* tables from template — outside the core transaction
    //    so a slow DB or many services don't kill the user/provider creation.
    try {
      const businessId = `biz_${provider.id}`
      await createBusinessFromTemplate(prisma as any, businessId, provider.id, templateConfig)
    } catch (templateError) {
      // Non-fatal — user and provider were created successfully.
      // The business config can be created later on first dashboard load.
      console.error('[register] Business template creation failed (non-critical):', templateError)
    }

    // Send welcome email
    try {
      if (provider) {
        const verifyUrl = `${process.env.NEXTAUTH_URL}/api/auth/verify-email?token=${verificationToken}`
        const businessTypeName = data.businessType === 'driving' ? 'driving instructor' 
          : data.businessType === 'plumber' ? 'plumber'
          : data.businessType === 'electrician' ? 'electrician'
          : data.businessType === 'beauty' ? 'beauty professional'
          : data.businessType === 'tax' ? 'tax professional'
          : 'service provider'

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
                <p>Hi ${provider.name},</p>
                <p>Thank you for registering as a ${businessTypeName} on our platform!</p>

                <div class="info-box">
                  <h3 style="margin-top: 0;">✅ Verify Your Email</h3>
                  <p style="margin: 10px 0;">Please verify your email to access your dashboard.</p>
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
                  <li>✅ Accept bookings from customers</li>
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
                  <p>${process.env.PLATFORM_NAME || 'DriveBook'} - Your Professional Service Platform</p>
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
      if (provider) {
        const businessTypeName = data.businessType === 'driving' ? 'Driving Instructor'
          : data.businessType === 'plumber' ? 'Plumber'
          : data.businessType === 'electrician' ? 'Electrician'
          : data.businessType === 'beauty' ? 'Beauty Professional'
          : data.businessType === 'tax' ? 'Tax Professional'
          : 'Service Provider'

        await emailService.sendGenericEmail({
          from: 'DriveBook Support <support@drivebook.com.au>',
          to: process.env.ADMIN_EMAIL || 'admin@drivebook.com',
          subject: `🆕 New ${businessTypeName} Registration`,
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
              .label { font-weight: bold; color: #1f2937; display: inline-block; width: 140px; }
              .button { display: inline-block; background: #10b981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="margin: 0;">🆕 New ${businessTypeName} Registration</h1>
              </div>
              <div class="content">
                <p>A new provider has registered and is awaiting approval.</p>
                
                <div class="info-box">
                  <h3 style="margin-top: 0;">Provider Details:</h3>
                  <div class="info-row">
                    <span class="label">Business Type:</span> <strong>${businessTypeName}</strong>
                  </div>
                  <div class="info-row">
                    <span class="label">Name:</span> <strong>${provider.name}</strong>
                  </div>
                  <div class="info-row">
                    <span class="label">Email:</span> ${user.email}
                  </div>
                  <div class="info-row">
                    <span class="label">Phone:</span> ****${provider.phone.slice(-4)}
                  </div>
                  <div class="info-row">
                    <span class="label">Registered:</span> ${new Date().toLocaleString()}
                  </div>
                </div>
                
                <p><strong>Action Required:</strong> Please review and approve/reject this application.</p>
                
                <div style="text-align: center;">
                  <a href="${process.env.NEXTAUTH_URL}/admin/register" class="button">Review Application</a>
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

    // Onboarding email (driving-specific only for now)
    // Fire-and-forget — registration must not fail if this email fails.
    if (data.businessType === 'driving' && provider && user.email) {
      const { sendOnboardingStep } = await import('@/lib/extensions/driving/emails/onboarding-sequence')
      sendOnboardingStep(
        {
          id: provider.id,
          name: provider.name,
          email: user.email,
          voiceLineStatus: 'NONE',
          subscriptionTier: 'BASIC',
        },
        'onboarding.welcome',
        1
      ).catch(e => console.error('[register] Onboarding welcome email failed (non-critical):', e))
    }

    return NextResponse.json(
      { 
        message: 'Registration successful. Please verify your email then log in.',
        userId: user.id,
        providerId: provider.id,
        businessType: data.businessType,
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
