import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { isValidABNFormat, isValidBSB, isValidBankAccount } from '@/lib/utils/abn-validation';

export const dynamic = 'force-dynamic';

const schema = z.object({
  payoutMethod:      z.enum(['stripe_connect', 'bank_transfer', 'manual']).optional(),
  bankBsb:           z.string().max(7).optional().nullable(),
  bankAccount:       z.string().min(4).max(10).optional().nullable(),
  bankAccountName:   z.string().min(2).max(100).optional().nullable(),
  abn:               z.string().regex(/^\d{11}$/, 'ABN must be 11 digits').optional().nullable(),
  gstRegistered:     z.boolean().optional(),
  abnEntityName:     z.string().max(200).optional().nullable(),
  abnVerified:       z.boolean().optional(),
  abnStatus:         z.string().optional().nullable(),
  withholdingTaxRate: z.number().min(0).max(100).optional(),
  // taxFileNumber: not collected — activate when legally required
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'INSTRUCTOR') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const instructor = await prisma.instructor.findUnique({
    where: { userId: session.user.id },
    select: {
      payoutMethod: true,
      bankBsb: true,
      bankAccount: true,
      bankAccountName: true,
      abn: true,
      abnVerified: true,
      abnStatus: true,
      abnEntityName: true,
      gstRegistered: true,
      withholdingTaxRate: true,
      stripeAccountId: true,
      name: true,
    },
  });

  if (!instructor) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(instructor);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'INSTRUCTOR') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    console.log('[payout-settings POST] schema validation failed:', parsed.error.errors);
    return NextResponse.json({ error: parsed.error.errors }, { status: 400 });
  }

  const data = parsed.data;

  // Normalise BSB — store without hyphen, validate format
  if (data.bankBsb) {
    if (!isValidBSB(data.bankBsb)) {
      return NextResponse.json({ error: 'Invalid BSB format — must be 6 digits (XXX-XXX or XXXXXX)' }, { status: 400 });
    }
    data.bankBsb = data.bankBsb.replace('-', '');
  }

  // Validate account number format
  if (data.bankAccount && !isValidBankAccount(data.bankAccount)) {
    return NextResponse.json({ error: 'Invalid account number — must be 6–10 digits' }, { status: 400 });
  }

  // Fetch current ABN from DB to detect whether it actually changed
  const current = await prisma.instructor.findUnique({
    where: { userId: session.user.id },
    select: { abn: true },
  });

  const incomingAbn = data.abn ?? null;
  const existingAbn = current?.abn ?? null;
  const abnChanged = incomingAbn !== existingAbn;

  console.log('[payout-settings POST] ABN check — incoming:', incomingAbn, '| existing:', existingAbn, '| changed:', abnChanged);
  if (incomingAbn && !isValidABNFormat(incomingAbn)) {    return NextResponse.json({ error: 'Invalid ABN — checksum failed' }, { status: 400 });
  }

  // Only reset verification state when the ABN number itself changes.
  // If ABN is the same (re-saving), preserve existing verified status and entity name.
  let abnFields: Record<string, unknown> = {};
  let withholdingTaxRate: number | undefined;

  if (abnChanged) {
    if (incomingAbn) {
      // New ABN — reset verification, entity name must be re-confirmed
      abnFields = { abnVerified: false, abnStatus: 'PENDING', abnEntityName: null, abnVerifiedAt: null, abnVerifiedBy: null };
    } else {
      // ABN cleared
      abnFields = { abnVerified: false, abnStatus: null, abnEntityName: null, abnVerifiedAt: null, abnVerifiedBy: null };
    }
    withholdingTaxRate = 47; // reset until admin re-verifies
  }
  // abnChanged = false: preserve existing abnVerified, abnStatus, withholdingTaxRate
  // abnEntityName from the request body will be saved via ...data spread (if provided)

  // Strip verification fields from data spread — handled explicitly below
  const { abnEntityName, abnVerified, abnStatus, withholdingTaxRate: wtFromClient, ...dataCore } = data;

  // When ABN unchanged: persist the verification state the client just confirmed
  const verificationUpdate: Record<string, unknown> = abnChanged ? {} : {
    ...(abnEntityName !== undefined ? { abnEntityName } : {}),
    ...(abnVerified !== undefined ? { abnVerified } : {}),
    ...(abnStatus !== undefined ? { abnStatus } : {}),
    // Only allow client to lower withholding (0%) if they're claiming verified.
    // Never allow client to set 0% without abnVerified = true.
    ...(wtFromClient !== undefined && abnVerified === true ? { withholdingTaxRate: wtFromClient } : {}),
  };

  const updated = await prisma.instructor.update({
    where: { userId: session.user.id },
    data: {
      ...dataCore,
      ...verificationUpdate,
      ...abnFields,
      ...(withholdingTaxRate !== undefined ? { withholdingTaxRate } : {}),
    },
    select: {
      payoutMethod: true,
      bankBsb: true,
      bankAccount: true,
      bankAccountName: true,
      abn: true,
      abnVerified: true,
      abnStatus: true,
      abnEntityName: true,
      gstRegistered: true,
      withholdingTaxRate: true,
      stripeAccountId: true,
    },
  });

  return NextResponse.json({ success: true, settings: updated });
}

