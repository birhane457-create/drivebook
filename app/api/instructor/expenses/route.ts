import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
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

    let dateFilter: any = {};
    if (year && month) {
      const y = parseInt(year);
      const m = parseInt(month) - 1; // JS months are 0-indexed
      dateFilter = {
        date: {
          gte: new Date(y, m, 1),
          lt: new Date(y, m + 1, 1),
        },
      };
    } else if (year) {
      const y = parseInt(year);
      dateFilter = {
        date: {
          gte: new Date(y, 0, 1),
          lt: new Date(y + 1, 0, 1),
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

    const expense = await (prisma as any).instructorExpense.create({
      data: {
        instructorId: session.user.instructorId,
        date: new Date(data.date + 'T00:00:00'),
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
