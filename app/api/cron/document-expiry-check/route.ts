import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { notifyDocumentExpiring } from '@/lib/services/notifications';

export const dynamic = 'force-dynamic';

/**
 * Document Expiry Check Cron
 * Runs weekly on Mondays at 2am UTC.
 * Sends proactive reminders to instructors whose documents expire within 30 days.
 * 
 * Documents checked: licenseExpiry, insuranceExpiry, policeCheckExpiry, wwcCheckExpiry
 * Schedule: "0 2 * * 1" in vercel.json
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Find instructors with documents expiring in the next 30 days
    const instructors = await prisma.instructor.findMany({
      where: {
        userId: { not: null },
        OR: [
          { licenseExpiry: { gte: now, lte: in30Days } },
          { insuranceExpiry: { gte: now, lte: in30Days } },
          { policeCheckExpiry: { gte: now, lte: in30Days } },
          { wwcCheckExpiry: { gte: now, lte: in30Days } },
        ],
      },
      select: {
        userId: true,
        name: true,
        licenseExpiry: true,
        insuranceExpiry: true,
        policeCheckExpiry: true,
        wwcCheckExpiry: true,
      },
    });

    let sent = 0;
    let failed = 0;

    for (const instructor of instructors) {
      if (!instructor.userId) continue;

      const docs = [
        { name: 'Driver Licence', expiry: instructor.licenseExpiry },
        { name: 'Insurance Policy', expiry: instructor.insuranceExpiry },
        { name: 'Police Check', expiry: instructor.policeCheckExpiry },
        { name: 'Working With Children Check', expiry: instructor.wwcCheckExpiry },
      ];

      for (const doc of docs) {
        if (!doc.expiry) continue;
        const expiryDate = new Date(doc.expiry);
        if (expiryDate >= now && expiryDate <= in30Days) {
          try {
            await notifyDocumentExpiring(instructor.userId, doc.name, expiryDate);
            sent++;
          } catch (err) {
            console.error(`Document expiry notification failed for ${instructor.name} — ${doc.name}:`, err);
            failed++;
          }
        }
      }
    }

    console.log(`✅ Document expiry check: ${sent} reminders sent, ${failed} failed`);
    return NextResponse.json({ success: true, sent, failed, instructorsChecked: instructors.length });
  } catch (error) {
    console.error('Document expiry cron error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
