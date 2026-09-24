import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { notifyDocumentExpiring } from '@/lib/services/notifications';
import { pingCronHealth, failCronHealth } from '@/lib/services/cron-health';

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
    // Also fix the CRON_SECRET guard — fail closed when unset
    const authHeader = req.headers.get('authorization');
    if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Expiry dates live in DrivingProviderProfile (D7 migration â€” removed from Instructor)
    const expiringProfiles = await (prisma as any).drivingProviderProfile.findMany({
      where: {
        OR: [
          { licenseExpiry: { gte: now, lte: in30Days } },
          { insuranceExpiry: { gte: now, lte: in30Days } },
          { policeCheckExpiry: { gte: now, lte: in30Days } },
          { wwcCheckExpiry: { gte: now, lte: in30Days } },
        ],
      },
      select: {
        providerId: true,
        insuranceExpiry: true,
        policeCheckExpiry: true,
        wwcCheckExpiry: true,
      },
    });
    // Fetch the provider name/userId for each profile
    const providerIds = expiringProfiles.map((p: any) => p.providerId);
    const providers = await (prisma as any).provider.findMany({
      where: { id: { in: providerIds } },
      select: { id: true, name: true, userId: true },
    });
    const providerMap = new Map(providers.map((p: any) => [p.id, p]));
    const instructors = expiringProfiles.map((p: any) => ({
      userId:            (providerMap.get(p.providerId) as any)?.userId ?? null,
      name:              (providerMap.get(p.providerId) as any)?.name ?? 'Unknown',
      licenseExpiry:     p.licenseExpiry,
      insuranceExpiry:   p.insuranceExpiry,
      policeCheckExpiry: p.policeCheckExpiry,
      wwcCheckExpiry:    p.wwcCheckExpiry,
    }));

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

    // DOC-EXP-01 fix: flip documentsVerified=false for providers with ALREADY-expired docs.
    // The cron above only notifies for docs expiring within 30 days. This block handles
    // docs that have already passed their expiry date — it marks the provider's
    // documentsVerified flag false so admin dashboards and future checks reflect reality.
    const now2 = new Date();
    const alreadyExpired = await (prisma as any).drivingProviderProfile.findMany({
      where: {
        OR: [
          { licenseExpiry:     { lt: now2 } },
          { insuranceExpiry:   { lt: now2 } },
          { policeCheckExpiry: { lt: now2 } },
          { wwcCheckExpiry:    { lt: now2 } },
        ],
      },
      select: { providerId: true },
    });

    let flagged = 0;
    for (const p of alreadyExpired) {
      try {
        await (prisma as any).provider.updateMany({
          where: { id: p.providerId, documentsVerified: true },
          data:  { documentsVerified: false },
        });
        flagged++;
      } catch (e) {
        console.error(`Failed to flag expired docs for provider ${p.providerId}:`, e);
      }
    }
    if (flagged > 0) {
      console.log(`⚠️  Flagged ${flagged} provider(s) with expired documents (documentsVerified → false)`);
    }

    await pingCronHealth('document-expiry-check');
    return NextResponse.json({ success: true, sent, failed, instructorsChecked: instructors.length, flagged });
  } catch (error) {
    console.error('Document expiry cron error:', error);
    await failCronHealth('document-expiry-check', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
