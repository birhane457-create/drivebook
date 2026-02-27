import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { prisma } from '@/lib/prisma';

// GET - Fetch all staff members
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN' && user.role !== 'STAFF')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const staff = await prisma.staffMember.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        email: true,
        department: true,
        currentLoad: true,
        maxCapacity: true,
        tasksCompleted: true,
        avgResolutionTimeHours: true,
        satisfactionScore: true,
        skills: true,
        isActive: true
      },
      orderBy: { name: 'asc' }
    });

    return NextResponse.json(staff);
  } catch (error) {
    console.error('Error fetching staff members:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
