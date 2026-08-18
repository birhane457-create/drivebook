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

// ── OTP rate limiter ─────────────────────────────────────────────────────────
// FIX #6: Replace in-memory Map with Upstash Redis rate limiter when configured.
// Upstash is already the standard rate-limit backend for bookings (lib/ratelimit.ts).
// Falls back to in-memory when UPSTASH_REDIS_REST_URL is not set (local dev).

const isUpstashConfigured = !!(
  process.env.UPSTASH_REDIS_REST_URL &&
  process.env.UPSTASH_REDIS_REST_TOKEN &&
  !process.env.UPSTASH_REDIS_REST_URL.includes('your-database')
);

// In-memory fallback — only used when Upstash is not configured
const memRateLimitMap = new Map<string, { count: number; windowStart: number; lastSent: number }>();

async function checkOtpRateLimit(key: string): Promise<{ allowed: boolean; retryAfter?: number }> {
  const now = Date.now();
  const windowMs = 60 * 60 * 1000; // 1 hour
  const resendDelayMs = 60 * 1000;  // 60 seconds
  const maxPerHour = 3;

  if (isUpstashConfigured) {
    // Redis-backed — survives cold starts and multiple instances
    try {
      const { Redis } = await import('@upstash/redis');
      const { Ratelimit } = await import('@upstash/ratelimit');
      const redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL!,
        token: process.env.UPSTASH_REDIS_REST_TOKEN!,
      });

      // Sliding window: 3 requests per hour
      const limiter = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(maxPerHour, '1 h'),
      });
      const { success, reset } = await limiter.limit(`otp:${key}`);
      if (!success) {
        return { allowed: false, retryAfter: Math.ceil((reset - now) / 1000) };
      }

      // Resend delay: store last-sent in Redis with 60s TTL
      const resendKey = `otp-resend:${key}`;
      const lastSent = await redis.get<number>(resendKey);
      if (lastSent && now - lastSent < resendDelayMs) {
        return { allowed: false, retryAfter: Math.ceil((resendDelayMs - (now - lastSent)) / 1000) };
      }
      await redis.set(resendKey, now, { ex: 60 });

      return { allowed: true };
    } catch (err) {
      console.error('[OTP RATE LIMIT] Redis check failed, falling back to in-memory:', err);
      // Fall through to in-memory
    }
  }

  // In-memory fallback
  const entry = memRateLimitMap.get(key);
  if (!entry || now - entry.windowStart > windowMs) {
    memRateLimitMap.set(key, { count: 1, windowStart: now, lastSent: now });
    return { allowed: true };
  }
  if (now - entry.lastSent < resendDelayMs) {
    return { allowed: false, retryAfter: Math.ceil((resendDelayMs - (now - entry.lastSent)) / 1000) };
  }
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
    const rateCheck = await checkOtpRateLimit(identifier);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Too many OTP requests. Please wait before trying again.', retryAfter: rateCheck.retryAfter },
        { status: 429 }
      );
    }

    // Find user + generate OTP in parallel — both are independent
    const [userResult] = await Promise.all([
      data.email
        ? prisma.user.findUnique({ where: { email: data.email }, select: { id: true, email: true } })
        : prisma.client.findFirst({
            where: { phone: data.phone!.replace(/\s/g, '') },
            select: { user: { select: { id: true, email: true } } },
          }).then(c => c?.user ?? null),
    ]);
    const user = userResult as { id: string; email: string } | null;

    // Generate 6-digit OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    const otpExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
    const verificationId = crypto.randomUUID();

    // FIX #5: Hash the OTP before storing — plain-text OTP in DB is a data-leak risk.
    // We store HMAC-SHA256(otp, OTP_HASH_SECRET) so a DB read never reveals the code.
    // Falls back to a per-instance secret if OTP_HASH_SECRET is not set (dev only).
    const otpSecret = process.env.OTP_HASH_SECRET || 'dev-otp-secret-change-in-prod';
    const otpHash = crypto.createHmac('sha256', otpSecret).update(otp).digest('hex');

    // Store hashed OTP — must complete before we respond (confirm needs it in DB)
    if (user) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          resetToken: `otp:${verificationId}:${otpHash}`,
          resetTokenExpiry: otpExpiry,
        },
      });
    }
    // No user found — OTP not stored, confirm will fail gracefully (prevents enumeration)

    // Send email/SMS with proper await to ensure delivery completes before serverless termination
    // FIX: Fire-and-forget delivery doesn't work in production (Vercel serverless)
    // Functions terminate immediately after response, preventing email delivery
    try {
      if (data.email && user) {
        await emailService.sendGenericEmail({
          from: 'DriveBook Account Verification <verification@drivebook.com.au>',
          to: data.email,
          subject: 'Your DriveBook verification code',
          html: `
            <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px">
              <h2 style="margin:0 0 8px;font-size:18px;color:#0f172a">Your verification code</h2>
              <p style="margin:0 0 20px;color:#475569;font-size:14px">
                Enter this code on the DriveBook login screen. It expires in 5 minutes.
              </p>
              <div style="background:#f1f5f9;border-radius:10px;padding:20px;text-align:center;margin-bottom:20px">
                <span style="font-size:36px;font-weight:bold;letter-spacing:12px;color:#0f172a">${otp}</span>
              </div>
              <p style="margin:0;color:#94a3b8;font-size:12px">
                If you didn't request this code, someone may be attempting to access your account.
                You can safely ignore this email — your account remains secure.
              </p>
            </div>
          `,
        });
      } else if (data.phone) {
        const { smsService } = await import('@/lib/services/sms');
        await smsService.sendSMS({
          to: data.phone!,
          message: `DriveBook verification code: ${otp}. Expires in 5 minutes.`,
        });
      }
    } catch (err) {
      console.error('[OTP] Delivery failed:', err);
      // Don't fail the request - OTP is stored, user can request a new one if needed
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
