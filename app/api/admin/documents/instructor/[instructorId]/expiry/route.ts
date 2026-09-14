import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/requireRole';
import { PERM } from '@/lib/rbac/permissions';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// Zod schema for expiry date validation
const expiryDateSchema = z.object({
  licenseExpiry: z.string().datetime().nullable().optional(),
  insuranceExpiry: z.string().datetime().nullable().optional(),
  policeCheckExpiry: z.string().datetime().nullable().optional(),
  wwcCheckExpiry: z.string().datetime().nullable().optional(),
});

// Validate date is within reasonable range (2000-2100)
function validateDateRange(dateString: string | null, fieldName: string): Date | null {
  if (!dateString) return null;
  
  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date format for ${fieldName}: ${dateString}`);
  }
  
  const year = date.getFullYear();
  if (year < 2000 || year > 2100) {
    throw new Error(`Date out of acceptable range (2000-2100) for ${fieldName}: ${dateString}`);
  }
  
  return date;
}

export async function POST(
  req: NextRequest,
  { params }: { params: { providerId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    const deny = await requirePermission(session, PERM.OPERATIONS_DOCUMENTS_VERIFY);
    if (deny) return deny;

    // Validate provider exists
    const provider = await prisma.provider.findUnique({
      where: { id: params.providerId },
      select: { id: true, name: true },
    });

    if (!provider) {
      return NextResponse.json({ error: 'Provider not found' }, { status: 404 });
    }

    // Parse and validate request body
    const body = await req.json();
    const parsed = expiryDateSchema.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json({ 
        error: 'Invalid request data', 
        issues: parsed.error.issues 
      }, { status: 400 });
    }

    const { licenseExpiry, insuranceExpiry, policeCheckExpiry, wwcCheckExpiry } = parsed.data;

    // Validate date ranges
    const updateData: any = {};
    
    try {
      if (licenseExpiry !== undefined) {
        updateData.licenseExpiry = validateDateRange(licenseExpiry, 'licenseExpiry');
      }
      if (insuranceExpiry !== undefined) {
        updateData.insuranceExpiry = validateDateRange(insuranceExpiry, 'insuranceExpiry');
      }
      if (policeCheckExpiry !== undefined) {
        updateData.policeCheckExpiry = validateDateRange(policeCheckExpiry, 'policeCheckExpiry');
      }
      if (wwcCheckExpiry !== undefined) {
        updateData.wwcCheckExpiry = validateDateRange(wwcCheckExpiry, 'wwcCheckExpiry');
      }
    } catch (validationError: any) {
      return NextResponse.json({ 
        error: validationError.message 
      }, { status: 400 });
    }

    // Update CORRECT table: DrivingProviderProfile (not Provider)
    // This preserves multi-vertical architecture: driving-specific fields in extension table
    await prisma.drivingProviderProfile.upsert({
      where: { providerId: params.providerId },
      create: {
        providerId: params.providerId,
        ...updateData,
      },
      update: updateData,
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: 'EXPIRY_DATES_UPDATED',
        actorId: session!.user!.id,
        actorRole: session!.user!.role,
        targetType: 'drivingProviderProfile',
        targetId: params.providerId,
        metadata: {
          providerName: provider.name,
          updatedFields: updateData,
        },
        success: true,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update expiry error:', error);
    return NextResponse.json({ error: 'Failed to update expiry dates' }, { status: 500 });
  }
}
