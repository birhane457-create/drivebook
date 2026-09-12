import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { notifyDocumentExpiring } from '@/lib/services/notifications';
import { requirePermission } from '@/lib/auth/requireRole';
import { PERM } from '@/lib/rbac/permissions';
import { mergeDrivingProfile } from '@/lib/extensions/driving/providerProfile';
export const dynamic = 'force-dynamic';

function docStatus(expiry: string | null, docUrl: string | null) {
  if (!docUrl) return { status: 'expired' as const, issue: 'missing' };
  if (!expiry) return { status: 'expiring' as const, issue: 'no expiry set' };
  const days = (new Date(expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  if (days < 0) return { status: 'expired' as const, issue: 'expired' };
  if (days < 30) return { status: 'expiring' as const, issue: 'expiring soon' };
  return { status: 'valid' as const, issue: null };
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const deny = await requirePermission(session, PERM.OPERATIONS_DOCUMENTS_VIEW);
    if (deny) return deny;

    const instructorsBase = await (prisma as any).provider.findMany({
      select: {
        id: true,
        name: true,
        phone: true,
        isActive: true,
        documentsVerified: true,
        // Legacy JSON fallback
        workingHours: true,
        user: { select: { email: true } },
      },
    }) as any[];

    // Batch-merge driving doc fields from extension table
    const instructors = await Promise.all(
      instructorsBase.map((i: any) => mergeDrivingProfile(i.id, i as any))
    );

    const compliance = instructors.map((i: any) => {
      // Prefer dedicated DateTime columns from extension table; fall back to workingHours.expiry
      const wh = (i.workingHours as any) || {};
      const legacyExp = wh.expiry || {};

      const isoOrNull = (v: any) => v instanceof Date ? v.toISOString() : (v ?? null);

      const licExpiry    = isoOrNull(i.licenseExpiry)    ?? legacyExp.licenseExpiry    ?? null;
      const insExpiry    = isoOrNull(i.insuranceExpiry)   ?? legacyExp.insuranceExpiry   ?? null;
      const polExpiry    = isoOrNull(i.policeCheckExpiry) ?? legacyExp.policeCheckExpiry ?? null;
      const wwcExpiry    = isoOrNull(i.wwcCheckExpiry)    ?? legacyExp.wwcCheckExpiry    ?? null;

      const license   = docStatus(licExpiry, i.licenseImageFront);
      const insurance = docStatus(insExpiry, i.insurancePolicyDoc);
      const police    = docStatus(polExpiry, i.policeCheckDoc);
      const wwc       = docStatus(wwcExpiry, i.wwcCheckDoc);

      const issues: string[] = [];
      if (license.issue) issues.push(`License: ${license.issue}`);
      if (insurance.issue) issues.push(`Insurance: ${insurance.issue}`);
      if (police.issue) issues.push(`Police check: ${police.issue}`);
      if (wwc.issue) issues.push(`WWC: ${wwc.issue}`);

      const statuses = [license.status, insurance.status, police.status, wwc.status];
      const overallStatus = statuses.includes('expired') ? 'expired'
        : statuses.includes('expiring') ? 'expiring'
        : 'valid';

      return {
        providerId: i.id,
        name: i.name,
        email: (i as any).user?.email || 'N/A',
        phone: i.phone,
        status: overallStatus,
        issues,
        isActive: i.isActive,
        documentsVerified: i.documentsVerified,
        licenseExpiry:    licExpiry,
        insuranceExpiry:  insExpiry,
        policeCheckExpiry: polExpiry,
        wwcCheckExpiry:   wwcExpiry,
      };
    });

    return NextResponse.json(compliance);
  } catch (error) {
    console.error('Compliance check error:', error);
    return NextResponse.json({ error: 'Failed to check compliance' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const deny = await requirePermission(session, PERM.OPERATIONS_DOCUMENTS_VERIFY);
    if (deny) return deny;

    const { action, providerId } = await req.json();

    if (action === 'deactivate') {
      await (prisma as any).provider.update({
        where: { id: providerId },
        data: { isActive: false },
      });
      return NextResponse.json({ success: true });
    }

    if (action === 'sendReminder') {
      const instructorBase = await (prisma as any).provider.findUnique({
        where: { id: providerId },
        select: {
          name: true,
          userId: true,
          workingHours: true,
          user: { select: { email: true } },
        },
      });
      const instructor = instructorBase
        ? await mergeDrivingProfile((instructorBase as any).id ?? providerId, instructorBase as any) as any
        : null;
      if (instructor?.userId) {
        const wh = (instructor.workingHours as any) || {};
        const exp = wh.expiry || {};
        const docs = [
          { name: 'Driver Licence', expiry: exp.licenseExpiry, url: instructor.licenseImageFront },
          { name: 'Insurance Policy', expiry: exp.insuranceExpiry, url: instructor.insurancePolicyDoc },
          { name: 'Police Check', expiry: exp.policeCheckExpiry, url: instructor.policeCheckDoc },
          { name: 'Working With Children Check', expiry: exp.wwcCheckExpiry, url: instructor.wwcCheckDoc },
        ];
        const expiringDocs = docs.filter(d => d.url && d.expiry && docStatus(d.expiry, d.url).status !== 'valid');

        for (const doc of expiringDocs) {
          // In-app notification
          await notifyDocumentExpiring(instructor.userId, doc.name, new Date(doc.expiry!)).catch(() => {});
        }

        // Email reminder — send directly to instructor's email
        if (expiringDocs.length > 0 && instructor.user?.email) {
          const { emailService } = await import('@/lib/services/email');
          const docList = expiringDocs.map(d => {
            const days = Math.ceil((new Date(d.expiry!).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            return `<li><strong>${d.name}</strong> — ${days < 0 ? 'EXPIRED' : `expires in ${days} day${days !== 1 ? 's' : ''}`}</li>`;
          }).join('');
          await emailService.sendGenericEmail({
            to: instructor.user.email,
            subject: `Action required: ${expiringDocs.length} document${expiringDocs.length > 1 ? 's' : ''} expiring — ${instructor.name}`,
            html: `
              <h2>Document Expiry Reminder</h2>
              <p>Hi ${instructor.name},</p>
              <p>The following document${expiringDocs.length > 1 ? 's require' : ' requires'} your attention:</p>
              <ul>${docList}</ul>
              <p>Please upload updated documents from your <a href="${process.env.NEXTAUTH_URL}/dashboard/documents">instructor dashboard</a> to avoid suspension.</p>
            `,
          }).catch(e => console.error('Document reminder email failed:', e));
        }
      }
      return NextResponse.json({ success: true, message: 'Reminder sent' });
    }

    if (action === 'autoProcess') {
      const instructorsRaw = await (prisma as any).provider.findMany({
        where: { isActive: true },
        select: { id: true, workingHours: true },
      });
      const instructors = await Promise.all(
        instructorsRaw.map((i: any) => mergeDrivingProfile(i.id, i as any))
      ) as any[];

      let deactivated = 0;
      for (const i of instructors) {
        const wh = (i.workingHours as any) || {};
        const exp = wh.expiry || {};
        const statuses = [
          docStatus((exp as any).licenseExpiry || null, i.licenseImageFront).status,
          docStatus((exp as any).insuranceExpiry || null, i.insurancePolicyDoc).status,
          docStatus((exp as any).policeCheckExpiry || null, i.policeCheckDoc).status,
          docStatus((exp as any).wwcCheckExpiry || null, i.wwcCheckDoc).status,
        ];
        if (statuses.every(s => s === 'expired')) {
          await (prisma as any).provider.update({ where: { id: i.id }, data: { isActive: false } });
          deactivated++;
        }
      }

      return NextResponse.json({ success: true, message: `Auto-processed: ${deactivated} instructor(s) deactivated.` });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('Compliance POST error:', error);
    return NextResponse.json({ error: 'Failed to process action' }, { status: 500 });
  }
}
