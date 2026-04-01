import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { notifyDocumentExpiring } from '@/lib/services/notifications';

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
    if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const instructors = await prisma.instructor.findMany({
      select: {
        id: true,
        name: true,
        phone: true,
        isActive: true,
        documentsVerified: true,
        licenseImageFront: true,
        insurancePolicyDoc: true,
        policeCheckDoc: true,
        wwcCheckDoc: true,
        workingHours: true,
        user: { select: { email: true } },
      },
    });

    const compliance = instructors.map((i) => {
      const wh = (i.workingHours as any) || {};
      const exp = wh.expiry || {};

      const license = docStatus(exp.licenseExpiry || null, i.licenseImageFront);
      const insurance = docStatus(exp.insuranceExpiry || null, i.insurancePolicyDoc);
      const police = docStatus(exp.policeCheckExpiry || null, i.policeCheckDoc);
      const wwc = docStatus(exp.wwcCheckExpiry || null, i.wwcCheckDoc);

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
        instructorId: i.id,
        name: i.name,
        email: i.user?.email || 'N/A',
        phone: i.phone,
        status: overallStatus,
        issues,
        isActive: i.isActive,
        documentsVerified: i.documentsVerified,
        licenseExpiry: exp.licenseExpiry || null,
        insuranceExpiry: exp.insuranceExpiry || null,
        policeCheckExpiry: exp.policeCheckExpiry || null,
        wwcCheckExpiry: exp.wwcCheckExpiry || null,
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
    if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, instructorId } = await req.json();

    if (action === 'deactivate') {
      await prisma.instructor.update({
        where: { id: instructorId },
        data: { isActive: false },
      });
      return NextResponse.json({ success: true });
    }

    if (action === 'sendReminder') {
      const instructor = await prisma.instructor.findUnique({
        where: { id: instructorId },
        select: {
          userId: true,
          workingHours: true,
          licenseImageFront: true,
          insurancePolicyDoc: true,
          policeCheckDoc: true,
          wwcCheckDoc: true,
        },
      });
      if (instructor?.userId) {
        const wh = (instructor.workingHours as any) || {};
        const exp = wh.expiry || {};
        const docs = [
          { name: 'Driver Licence', expiry: exp.licenseExpiry, url: instructor.licenseImageFront },
          { name: 'Insurance Policy', expiry: exp.insuranceExpiry, url: instructor.insurancePolicyDoc },
          { name: 'Police Check', expiry: exp.policeCheckExpiry, url: instructor.policeCheckDoc },
          { name: 'Working With Children Check', expiry: exp.wwcCheckExpiry, url: instructor.wwcCheckDoc },
        ];
        for (const doc of docs) {
          if (doc.url && doc.expiry) {
            const status = docStatus(doc.expiry, doc.url);
            if (status.status !== 'valid') {
              await notifyDocumentExpiring(instructor.userId, doc.name, new Date(doc.expiry)).catch(() => {});
            }
          }
        }
      }
      return NextResponse.json({ success: true, message: 'Reminder sent' });
    }

    if (action === 'autoProcess') {
      const instructors = await prisma.instructor.findMany({
        where: { isActive: true },
        select: {
          id: true,
          workingHours: true,
          licenseImageFront: true,
          insurancePolicyDoc: true,
          policeCheckDoc: true,
          wwcCheckDoc: true,
        },
      });

      let deactivated = 0;
      for (const i of instructors) {
        const wh = (i.workingHours as any) || {};
        const exp = wh.expiry || {};
        const statuses = [
          docStatus(exp.licenseExpiry || null, i.licenseImageFront).status,
          docStatus(exp.insuranceExpiry || null, i.insurancePolicyDoc).status,
          docStatus(exp.policeCheckExpiry || null, i.policeCheckDoc).status,
          docStatus(exp.wwcCheckExpiry || null, i.wwcCheckDoc).status,
        ];
        if (statuses.every(s => s === 'expired')) {
          await prisma.instructor.update({ where: { id: i.id }, data: { isActive: false } });
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
