// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

function decorateNotification(notification: any) {
  const metadata = notification?.metadata && typeof notification.metadata === 'object' ? notification.metadata : {};
  return {
    ...notification,
    // UI expects these legacy fields; DB uses `link` + `metadata`.
    actionUrl: notification?.link ?? undefined,
    actionButtonLabel: metadata?.actionButtonLabel ?? undefined,
    relatedEntityId: metadata?.relatedEntityId ?? undefined,
    relatedEntityType: metadata?.relatedEntityType ?? undefined,
  };
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get current user
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const type = searchParams.get('type');
    const isRead = searchParams.get('isRead');

    const skip = (page - 1) * limit;

    // Build query filters
    const where: any = {
      userId: user.id,
    };

    if (type) {
      where.type = type;
    }

    if (isRead !== null && isRead !== undefined) {
      where.isRead = isRead === 'true';
    }

    // Get total count
    const total = await prisma.notification.count({ where });

    // Get unread count
    const unreadCount = await prisma.notification.count({
      where: {
        userId: user.id,
        isRead: false,
      },
    });

    // Get notifications
    const notifications = await prisma.notification.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take: limit,
    });

    return NextResponse.json({
      notifications: notifications.map(decorateNotification),
      total,
      unreadCount,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
