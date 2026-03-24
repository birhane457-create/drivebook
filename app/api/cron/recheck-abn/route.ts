/**
 * Cron: Weekly ABN Status Recheck
 *
 * Rechecks all instructors with a verified ABN against the ABR API.
 * If an ABN has been cancelled, clears abnVerified and sets abnStatus = CANCELLED.
 * This prevents instructors with lapsed ABNs from continuing to receive 0% withholding.
 *
 * Trigger: weekly (configure in vercel.json)
 * Auth: Bearer CRON_SECRET
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isValidABNFormat } from '@/lib/utils/abn-validation';
import { sendAlert } from '@/lib/services/alert-service';

export const dynamic = 'force-dynamic';

const ABR_GUID = process.env.ABR_GUID ?? '';
const ABR_URL = 'https://abr.business.gov.au/abrxmlsearch/AbrXmlSearch.asmx/SearchByABNv202001';

export async function GET(req: NextRequest) {
  // Auth
  const authHeader = req.headers.get('authorization');
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!ABR_GUID) {
    return NextResponse.json({ skipped: true, reason: 'ABR_GUID not configured' });
  }

  // Load all instructors with a verified ABN
  const instructors = await (prisma as any).instructor.findMany({
    where: { abn: { not: null }, abnVerified: true },
    select: { id: true, abn: true, abnStatus: true },
  });

  const results = { checked: 0, revoked: 0, errors: 0 };

  for (const inst of instructors) {
    if (!inst.abn || !isValidABNFormat(inst.abn)) continue;
    results.checked++;

    try {
      const url = `${ABR_URL}?searchString=${inst.abn}&includeHistoricalDetails=N&authenticationGuid=${ABR_GUID}`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'DriveBook/1.0 (contact@drivebook.com.au)' },
        next: { revalidate: 0 },
      });

      if (!res.ok) { results.errors++; continue; }

      const xml = await res.text();
      const abnStatus = extractXml(xml, 'abnStatus') ?? 'UNKNOWN';
      const isActive = abnStatus === 'Active';

      if (!isActive) {
        // ABN is no longer active — revoke verification, block payouts
        await (prisma as any).instructor.update({
          where: { id: inst.id },
          data: {
            abnVerified: false,
            abnStatus: 'CANCELLED',
            withholdingTaxRate: 47,
          },
        });

        await prisma.auditLog.create({
          data: {
            action: 'ABN_VERIFICATION_REVOKED',
            actorId: 'SYSTEM',
            actorRole: 'SYSTEM',
            targetType: 'INSTRUCTOR',
            targetId: inst.id,
            success: true,
            metadata: { abn: inst.abn, previousStatus: inst.abnStatus, newStatus: 'CANCELLED' },
          },
        });

        results.revoked++;

        // Alert — non-blocking
        void sendAlert({
          type: 'ABN_REVOKED',
          severity: 'CRITICAL',
          message: `ABN revoked for instructor ${inst.id} — payouts blocked`,
          entityId: inst.id,
          metadata: { abn: inst.abn, previousStatus: inst.abnStatus },
        });
      }
    } catch {
      results.errors++;
    }
  }

  console.log(`ABN recheck complete: ${results.checked} checked, ${results.revoked} revoked, ${results.errors} errors`);
  return NextResponse.json({ success: true, ...results });
}

function extractXml(xml: string, tag: string): string | null {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([^<]*)<\/${tag}>`));
  return match?.[1]?.trim() || null;
}
