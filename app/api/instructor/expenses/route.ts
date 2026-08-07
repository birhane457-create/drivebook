import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { resolveTimezone, timezoneFromState, localDateTimeToUTC } from '@/lib/utils/timezone';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const CATEGORIES = [
  'FUEL_VEHICLE',
  'INSURANCE',
  'TRAINING',
  'EQUIPMENT',
  'SUBSCRIPTION',
  'OTHER',
] as const;

const createSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  category: z.enum(CATEGORIES),
  description: z.string().min(1).max(200),
  amount: z.number().positive().max(100000),
});

// GET — list expenses for the authenticated instructor
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.instructorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const year = searchParams.get('year');
    const month = searchParams.get('month'); // 1-12

    // Resolve instructor timezone for correct local-day filtering
    const instr = await prisma.instructor.findUnique({ where: { id: session.user.instructorId }, select: { timezone: true, state: true } });
    const tz = resolveTimezone(instr?.timezone ?? timezoneFromState(instr?.state));

    let dateFilter: any = {};
    if (year && month) {
      const y = parseInt(year, 10);
      const m = parseInt(month, 10);
      const startLocal = `${y}-${String(m).padStart(2, '0')}-01`;
      const nextM = m === 12 ? 1 : m + 1;
      const nextY = m === 12 ? y + 1 : y;
      const startNextLocal = `${nextY}-${String(nextM).padStart(2, '0')}-01`;
      dateFilter = {
        date: {
          gte: localDateTimeToUTC(startLocal, '00:00', tz),
          lt: localDateTimeToUTC(startNextLocal, '00:00', tz),
        },
      };
    } else if (year) {
      const y = parseInt(year, 10);
      const startLocal = `${y}-01-01`;
      const startNextLocal = `${y + 1}-01-01`;
      dateFilter = {
        date: {
          gte: localDateTimeToUTC(startLocal, '00:00', tz),
          lt: localDateTimeToUTC(startNextLocal, '00:00', tz),
        },
      };
    }

    const expenses = await (prisma as any).instructorExpense.findMany({
      where: {
        instructorId: session.user.instructorId,
        ...dateFilter,
      },
      orderBy: { date: 'desc' },
    });

    return NextResponse.json({ expenses });
  } catch (error) {
    console.error('GET /api/instructor/expenses error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST — create a new expense
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.instructorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const data = createSchema.parse(body);

    // Resolve instructor timezone and convert local date to UTC midnight
    const instr2 = await prisma.instructor.findUnique({ where: { id: session.user.instructorId }, select: { timezone: true, state: true } });
    const tz2 = resolveTimezone(instr2?.timezone ?? timezoneFromState(instr2?.state));
    const utcDate = localDateTimeToUTC(data.date, '00:00', tz2);

    const expense = await (prisma as any).instructorExpense.create({
      data: {
        instructorId: session.user.instructorId,
        date: utcDate,
        category: data.category,
        description: data.description.trim(),
        amount: data.amount,
      },
    });

    return NextResponse.json({ expense }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.errors }, { status: 400 });
    }
    console.error('POST /api/instructor/expenses error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
