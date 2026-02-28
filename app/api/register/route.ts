import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { emailService } from '@/lib/services/email'


export const dynamic = 'force-dynamic';
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2),
  phone: z.string(),
  baseAddress: z.string(),
  baseLatitude: z.number(),
  baseLongitude: z.number(),
  hourlyRate: z.number(),
  vehicleTypes: z.array(z.enum(['AUTO', 'MANUAL'])),
  serviceRadiusKm: z.number(),
  licenseNumber: z.string().optional(),
  insuranceNumber: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const data = registerSchema.parse(body)

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email }
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 400 }
      )
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(data.password, 10)

    // Create user and instructor
    const user = await prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        role: 'INSTRUCTOR',
        instructor: {
          create: {
            name: data.name,
            phone: data.phone,
            baseAddress: data.baseAddress,
            baseLatitude: data.baseLatitude,
            baseLongitude: data.baseLongitude,
            hourlyRate: data.hourlyRate,
            vehicleTypes: data.vehicleTypes,
            serviceRadiusKm: data.serviceRadiusKm,
            languages: ['English'],
            ...(data.licenseNumber && { licenseNumber: data.licenseNumber }),
            ...(data.insuranceNumber && { insuranceNumber: data.insuranceNumber }),
            approvalStatus: 'PENDING', // Requires admin approval
            isActive: false, // Inactive until approved
            workingHours: {
              monday: [{ start: '09:00', end: '17:00' }],
              tuesday: [{ start: '09:00', end: '17:00' }],
              wednesday: [{ start: '09:00', end: '17:00' }],
              thursday: [{ start: '09:00', end: '17:00' }],
              friday: [{ start: '09:00', end: '17:00' }],
              saturday: [{ start: '09:00', end: '13:00' }],
              sunday: []
            }
          } as any // Temporary: Remove after running 'npx prisma generate'
        }
      },
      include: {
        instructor: true
      }
    })

    // Send welcome email to instructor
    try {
      const instructorData = user.instructor;
      if (instructorData) {
        await emailService.sendGenericEmail({
          to: user.email,
          subject: `Welcome to ${process.env.PLATFORM_NAME || 'DriveBook'}!`,
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
                    <span class="label">Phone:</span> ${instructorData.phone}
                  </div>
                  <div class="info-row">
                    <span class="label">Location:</span> ${instructorData.baseAddress}
                  </div>
                  <div class="info-row">
                    <span class="label">Hourly Rate:</span> $${instructorData.hourlyRate}
                  </div>
                  <div class="info-row">
                    <span class="label">Vehicle Types:</span> ${instructorData.vehicleTypes.join(', ')}
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
        message: 'Registration successful. Please complete your profile.',
        userId: user.id,
        status: 'pending_approval',
        redirectTo: '/setup/complete-profile'
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
