import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const CONFIG_PATH = path.join(process.cwd(), 'settings-config.json');

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
    BOOKING_REQUEST: notifChannelSchema,
    BOOKING_CONFIRMED: notifChannelSchema,
    BOOKING_CANCELLED: notifChannelSchema,
    BOOKING_RESCHEDULED: notifChannelSchema,
    PAYMENT_RECEIVED: notifChannelSchema,
    LESSON_REMINDER: notifChannelSchema,
    DOCUMENT_EXPIRING: notifChannelSchema,
    REVIEW_RECEIVED: notifChannelSchema,
    NEW_MESSAGE: notifChannelSchema,
    PAYOUT_PROCESSED: notifChannelSchema,
    NO_SHOW_FLAGGED: notifChannelSchema,
  }),
});

const DEFAULTS = {
  booking: {
    minAdvanceHours: 2,
    maxAdvanceDays: 60,
    packageBypassMinAdvance: true,
    maxLessonsPerDayPerInstructor: 8,
  },
  notifications: {
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
  },
};

function readConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8')) };
    }
  } catch {}
  return DEFAULTS;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json(readConfig());
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const body = await req.json();
    const settings = schema.parse(body);
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(settings, null, 2));
    return NextResponse.json({ success: true, settings });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error('Settings save error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
