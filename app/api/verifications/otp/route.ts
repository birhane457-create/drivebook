/**
 * POST /api/verifications/otp
 *
 * Sends an OTP (one-time password) to a phone number or email.
 * Used by the AI voice receptionist to verify caller identity before
 * sensitive actions (cancel, reschedule).
 *
 * Rate limits:
 * - Max 3 OTP requests per hour per phone/email
 * - Resend delay: 60 seconds
 *
 * OTP is stored in the User record using the existing resetToken/resetTokenExpiry fields.
 * TTL: 5 minutes
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { emailService } from '@/lib/services/email';
import { z } from 'zod';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

const schema = z.object({
  phone: z.string().optional(),
  email: z.string().email().optional(),
  purpose: z.enum(['cancel', 'reschedule', 'login']).default('cancel'),
}).refine(d => d.phone || d.email, { message: 'phone or email required' });

// Simple in-memory rate limiter (per phone/email, resets on cold start)
// For production: use Redis via Upstash
const rateLimitMap = new Map<string, { count: number; windowStart: number; lastSent: number }>();

function checkRateLimit(key: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const windowMs = 60 * 60 * 1000; // 1 hour
  const resendDelayMs = 60 * 1000; // 60 seconds
  const maxPerHour = 3;

  const entry = rateLimitMap.get(key);
  if (!entry || now - entry.windowStart > windowMs) {
    rateLimitMap.set(key, { count: 1, windowStart: now, lastSent: now });
    return { allowed: true };
  }

  // Check resend delay
  if (now - entry.lastSent < resendDelayMs) {
    return { allowed: false, retryAfter: Math.ceil((resendDelayMs - (now - entry.lastSent)) / 1000) };
  }

  // Check hourly limit
  if (entry.count >= maxPerHour) {
    return { allowed: false, retryAfter: Math.ceil((windowMs - (now - entry.windowStart)) / 1000) };
  }

  entry.count++;
  entry.lastSent = now;
  return { allowed: true };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = schema.parse(body);

    const identifier = data.phone || data.email!;
    const rateCheck = checkRateLimit(identifier);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Too many OTP requests. Please wait before trying again.', retryAfter: rateCheck.retryAfter },
        { status: 429 }
      );
    }

    // Find user by phone or email
    let user = null;
    if (data.email) {
      user = await prisma.user.findUnique({ where: { email: data.email } });
    } else if (data.phone) {
      // Look up via client or instructor phone
      const client = await prisma.client.findFirst({
        where: { phone: data.phone.replace(/\s/g, '') },
        include: { user: true },
      });
      user = client?.user ?? null;
    }

    // Generate 6-digit OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    const otpExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
    const verificationId = crypto.randomUUID();

    // Store OTP in user record if found, otherwise store in a temporary map
    // Using resetToken field as OTP storage (same pattern as password reset)
    if (user) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          resetToken: `otp:${verificationId}:${otp}`,
          resetTokenExpiry: otpExpiry,
        },
      });
    } else {
      // No user found — still generate OTP but don't store it
      // This prevents user enumeration (don't reveal if phone/email exists)
      // The confirm endpoint will fail gracefully
    }

    // Send OTP via email or SMS
    if (data.email && user) {
      await emailService.sendGenericEmail({
        to: data.email,
        subject: 'Your DriveBook verification code',
        html: `
          <p>Your verification code is: <strong style="font-size:24px;letter-spacing:4px">${otp}</strong></p>
          <p>This code expires in 5 minutes.</p>
          <p>If you didn't request this, please ignore this email.</p>
        `,
      });
    } else if (data.phone) {
      // SMS via Twilio
      try {
        const { smsService } = await import('@/lib/services/sms');
        await smsService.sendSMS({
          to: data.phone,
          message: `Your DriveBook verification code is: ${otp}. Expires in 5 minutes.`,
        });
      } catch (smsErr) {
        console.error('OTP SMS failed:', smsErr);
        // Don't fail the request — OTP is still stored
      }
    }

    return NextResponse.json({
      success: true,
      verificationId,
      expiresAt: otpExpiry.toISOString(),
      message: `Verification code sent to ${data.phone || data.email}`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error('OTP send error:', error);
    return NextResponse.json({ error: 'Failed to send verification code' }, { status: 500 });
  }
}
