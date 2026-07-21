import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET - fetch notifications for current user
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const notifications = await prisma.notification.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        userId: true,
        type: true,
        title: true,
        message: true,
        isRead: true,
        createdAt: true,
        link: true,          // DB column name for action URL
        // actionUrl / actionButtonLabel / relatedEntityId not in this schema version
      },
    });

    // Map DB field names to the shape the frontend expects
    const mapped = notifications.map(n => ({
      ...n,
      actionUrl: (n as any).link ?? null,
      actionButtonLabel: null,
    }));

    const unreadCount = await prisma.notification.count({
      where: { userId: session.user.id, isRead: false },
    });

    return NextResponse.json({ notifications: mapped, unreadCount });
  } catch (error) {
    console.error('Get notifications error:', error);
    // Return empty instead of 500 - DB may be temporarily unavailable
    return NextResponse.json({ notifications: [], unreadCount: 0 });
  }
}
