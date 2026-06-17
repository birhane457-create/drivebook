import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

/**
 * Platform settings are stored in the PlatformSettings Prisma model (key: "default").
 * The filesystem-based approach (settings-config.json) was removed — it fails silently
 * on serverless/containerised deployments where the working directory is read-only.
 *
 * Notification channel preferences (inApp/email/sms per event type) are stored in the
 * metadata JSON column of PlatformSettings as { notificationChannels: {...} } since
 * the schema doesn't have dedicated columns for them.
 */

const notifChannelSchema = z.object({
  inApp: z.boolean(),
  email: z.boolean(),
  sms: z.boolean(),
});

const schema = z.object({
  booking: z.object({
    minAdvanceHours: z.number().min(0).max(168),
    maxAdvanceDays: z.number().min(1).max(365),
    packageBypassMinAdvance: z.boolean(),
    maxLessonsPerDayPerInstructor: z.number().min(1).max(20),
  }),
  notifications: z.object({
    BOOKING_REQUEST:     notifChannelSchema,
    BOOKING_CONFIRMED:   notifChannelSchema,
    BOOKING_CANCELLED:   notifChannelSchema,
    BOOKING_RESCHEDULED: notifChannelSchema,
    PAYMENT_RECEIVED:    notifChannelSchema,
    LESSON_REMINDER:     notifChannelSchema,
    DOCUMENT_EXPIRING:   notifChannelSchema,
    REVIEW_RECEIVED:     notifChannelSchema,
    NEW_MESSAGE:         notifChannelSchema,
    PAYOUT_PROCESSED:    notifChannelSchema,
    NO_SHOW_FLAGGED:     notifChannelSchema,
  }),
});

const NOTIFICATION_DEFAULTS = {
  BOOKING_REQUEST:     { inApp: true,  email: false, sms: false },
  BOOKING_CONFIRMED:   { inApp: true,  email: true,  sms: true  },
  BOOKING_CANCELLED:   { inApp: true,  email: true,  sms: false },
  BOOKING_RESCHEDULED: { inApp: true,  email: true,  sms: false },
  PAYMENT_RECEIVED:    { inApp: true,  email: false, sms: false },
  LESSON_REMINDER:     { inApp: true,  email: false, sms: true  },
  DOCUMENT_EXPIRING:   { inApp: true,  email: true,  sms: false },
  REVIEW_RECEIVED:     { inApp: true,  email: false, sms: false },
  NEW_MESSAGE:         { inApp: true,  email: false, sms: false },
  PAYOUT_PROCESSED:    { inApp: true,  email: true,  sms: false },
  NO_SHOW_FLAGGED:     { inApp: true,  email: true,  sms: false },
}

const BOOKING_DEFAULTS = {
  minAdvanceHours: 2,
  maxAdvanceDays: 60,
  packageBypassMinAdvance: true,
  maxLessonsPerDayPerInstructor: 8,
}

async function readSettings() {
  try {
    const ps = await (prisma as any).platformSettings.findUnique({ where: { key: 'default' } })
    const meta = (ps?.metadata as Record<string, any>) ?? {}
    return {
      booking: meta.bookingSettings ?? BOOKING_DEFAULTS,
      notifications: meta.notificationChannels ?? NOTIFICATION_DEFAULTS,
    }
  } catch {
    return { booking: BOOKING_DEFAULTS, notifications: NOTIFICATION_DEFAULTS }
  }
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json(await readSettings());
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const settings = schema.parse(body);

    // Read existing metadata to merge — don't overwrite unrelated fields
    const existing = await (prisma as any).platformSettings.findUnique({ where: { key: 'default' } })
    const existingMeta = (existing?.metadata as Record<string, any>) ?? {}

    await (prisma as any).platformSettings.upsert({
      where: { key: 'default' },
      create: {
        key: 'default',
        metadata: {
          ...existingMeta,
          bookingSettings: settings.booking,
          notificationChannels: settings.notifications,
        },
        updatedBy: session.user.id ?? 'admin',
      },
      update: {
        metadata: {
          ...existingMeta,
          bookingSettings: settings.booking,
          notificationChannels: settings.notifications,
        },
        updatedBy: session.user.id ?? 'admin',
      },
    })

    return NextResponse.json({ success: true, settings });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error('Settings save error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
