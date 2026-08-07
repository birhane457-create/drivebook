// Job to generate package expiry notifications
// Runs every 15 min via notifications cron: alerts at 7d / 1d / today / yesterday (marks expired)

import { prisma } from '@/lib/prisma';
import { createNotification } from '@/lib/services/notificationService';
import { DEFAULT_TIMEZONE } from '@/lib/utils/timezone';

interface BookingWithClient {
  id: string;
  packageExpiryDate: Date | null;
  packageHoursRemaining: number | null;
  client: {
    userId: string | null;
  } | null;
}

const DEFAULT_TZ = DEFAULT_TIMEZONE;

function getLocalDateParts(date: Date, tz: string = DEFAULT_TZ) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? '0');

  return {
    year: value('year'),
    month: value('month'),
    day: value('day'),
  };
}

function getLocalDayRange(date: Date, tz: string = DEFAULT_TZ) {
  const { year, month, day } = getLocalDateParts(date, tz);
  // Build UTC boundary by offsetting from the IANA tz offset at midnight
  // We use Date.UTC with the local date values as a proxy; the tz offset
  // correction is handled by the Intl formatter above.
  const offsetMs = getUtcOffsetMs(date, tz);
  const start = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0) - offsetMs);
  const end   = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999) - offsetMs);
  return { start, end };
}

/** Returns the UTC offset in milliseconds for a given Date in the given IANA timezone */
function getUtcOffsetMs(date: Date, tz: string): number {
  const utcStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'UTC',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).format(date);
  const tzStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).format(date);
  return new Date(utcStr + 'Z').getTime() - new Date(tzStr + 'Z').getTime();
}

export async function generatePackageExpiryAlerts() {
  try {
    console.log('⏰ Starting package expiry alerts job...');

    const now = new Date();

    // 1. Packages expiring in 7 days
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const range7d = getLocalDayRange(in7Days);

    const expiringIn7Days = await prisma.booking.findMany({
      where: {
        isPackageBooking: true,
        packageExpiryDate: {
          gte: range7d.start,
          lte: range7d.end,
        },
        packageStatus: 'active',
      },
      include: {
        client: { select: { userId: true } },
      },
    }) as BookingWithClient[];

    for (const pkg of expiringIn7Days) {
      if (!pkg.client?.userId) continue;

      const existingNotif = await prisma.notification.findFirst({
        where: {
          userId: pkg.client.userId,
          type: 'PACKAGE_EXPIRY',
          metadata: {
            path: ['relatedEntityId'],
            equals: pkg.id,
          },
          createdAt: {
            gte: new Date(Date.now() - 23 * 60 * 60 * 1000),
          },
        },
      });

      if (!existingNotif) {
        await createNotification({
          userId: pkg.client.userId,
          type: 'PACKAGE_EXPIRY',
          title: '⏰ Package Expiring Soon',
          message: `Your package expires in 7 days. You have ${pkg.packageHoursRemaining?.toFixed(1) || 0}h remaining.`,
          relatedEntityId: pkg.id,
          relatedEntityType: 'PACKAGE',
          actionUrl: '/client-dashboard/packages',
          actionButtonLabel: 'Renew Package',
        });
        console.log(`✅ Created 7-day expiry alert for package ${pkg.id}`);
      }
    }

    // 2. Packages expiring in 1 day
    const in1Day = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);
    const range1d = getLocalDayRange(in1Day);

    const expiringIn1Day = await prisma.booking.findMany({
      where: {
        isPackageBooking: true,
        packageExpiryDate: {
          gte: range1d.start,
          lte: range1d.end,
        },
        packageStatus: 'active',
      },
      include: {
        client: { select: { userId: true } },
      },
    }) as BookingWithClient[];

    for (const pkg of expiringIn1Day) {
      if (!pkg.client?.userId) continue;

      const existingNotif = await prisma.notification.findFirst({
        where: {
          userId: pkg.client.userId,
          type: 'PACKAGE_EXPIRY',
          metadata: {
            path: ['relatedEntityId'],
            equals: pkg.id,
          },
          createdAt: {
            gte: new Date(Date.now() - 12 * 60 * 60 * 1000),
          },
        },
      });

      if (!existingNotif) {
        await createNotification({
          userId: pkg.client.userId,
          type: 'PACKAGE_EXPIRY',
          title: '🚨 Package Expires Tomorrow',
          message: `Your package expires tomorrow. Renew now to keep your ${pkg.packageHoursRemaining?.toFixed(1) || 0} hours.`,
          relatedEntityId: pkg.id,
          relatedEntityType: 'PACKAGE',
          actionUrl: '/client-dashboard/packages',
          actionButtonLabel: 'Renew Package',
        });
        console.log(`✅ Created 1-day expiry alert for package ${pkg.id}`);
      }
    }

    // 3. Packages expiring today
    const rangeToday = getLocalDayRange(now);

    const expiringToday = await prisma.booking.findMany({
      where: {
        isPackageBooking: true,
        packageExpiryDate: {
          gte: rangeToday.start,
          lte: rangeToday.end,
        },
        packageStatus: 'active',
      },
      include: {
        client: { select: { userId: true } },
      },
    }) as BookingWithClient[];

    for (const pkg of expiringToday) {
      if (!pkg.client?.userId) continue;

      const existingNotif = await prisma.notification.findFirst({
        where: {
          userId: pkg.client.userId,
          type: 'PACKAGE_EXPIRY',
          metadata: {
            path: ['relatedEntityId'],
            equals: pkg.id,
          },
          createdAt: {
            gte: new Date(Date.now() - 6 * 60 * 60 * 1000),
          },
        },
      });

      if (!existingNotif) {
        await createNotification({
          userId: pkg.client.userId,
          type: 'PACKAGE_EXPIRY',
          title: '⛔ Package Expires Today',
          message: `Your package expires today at midnight. You'll lose ${pkg.packageHoursRemaining?.toFixed(1) || 0}h if not renewed.`,
          relatedEntityId: pkg.id,
          relatedEntityType: 'PACKAGE',
          actionUrl: '/client-dashboard/packages',
          actionButtonLabel: 'Renew Now',
        });
        console.log(`✅ Created expiry-today alert for package ${pkg.id}`);
      }
    }

    // 4. Packages that expired yesterday (update them and notify)
    const yesterday = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
    const rangeYesterday = getLocalDayRange(yesterday);

    const expiredYesterday = await prisma.booking.findMany({
      where: {
        isPackageBooking: true,
        packageExpiryDate: {
          gte: rangeYesterday.start,
          lte: rangeYesterday.end,
        },
        packageStatus: 'active', // Still marked as active but is past expiry date
      },
      include: {
        client: { select: { userId: true } },
      },
    }) as BookingWithClient[];

    for (const pkg of expiredYesterday) {
      if (!pkg.client?.userId) continue;

      // Update package status to expired
      await prisma.booking.update({
        where: { id: pkg.id },
        data: { packageStatus: 'expired' },
      });

      const existingNotif = await prisma.notification.findFirst({
        where: {
          userId: pkg.client.userId,
          type: 'PACKAGE_EXPIRY',
          metadata: {
            path: ['relatedEntityId'],
            equals: pkg.id,
          },
          message: { contains: 'expired' },
        },
      });

      if (!existingNotif) {
        await createNotification({
          userId: pkg.client.userId,
          type: 'PACKAGE_EXPIRY',
          title: '❌ Package Expired',
          message: `Your package has expired. You've lost ${pkg.packageHoursRemaining?.toFixed(1) || 0}h of unused hours.`,
          relatedEntityId: pkg.id,
          relatedEntityType: 'PACKAGE',
          actionUrl: '/client-dashboard/packages',
          actionButtonLabel: 'View Packages',
        });
        console.log(`✅ Created expired notification for package ${pkg.id}`);
      }
    }

    console.log('✅ Package expiry alerts job completed');
    return { success: true };
  } catch (error) {
    console.error('❌ Error in package expiry alerts job:', error);
    throw error;
  }
}
