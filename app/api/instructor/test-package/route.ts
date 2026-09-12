import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { mergeDrivingProfile, upsertDrivingProfile } from '@/lib/extensions/driving/providerProfile';


export const dynamic = 'force-dynamic';
const testPackageSchema = z.object({
  offersTestPackage: z.boolean(),
  testPackagePrice: z.number().min(0).optional().nullable(),
  testPackageDuration: z.number().min(0).optional().nullable(),
  testPackageIncludes: z.array(z.string()).optional()
});

// GET - Fetch instructor's test package settings
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.providerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const instructor = await prisma.provider.findUnique({
      where: { id: session!.user!.providerId },
      select: { id: true }
    }) as any;

    if (!instructor) {
      return NextResponse.json({ error: 'Instructor not found' }, { status: 404 });
    }

    // Read test package fields from extension table (falls back to Instructor cols)
    const profile = await mergeDrivingProfile(instructor.id, {
      offersTestPackage: false,
      testPackageDuration: null,
      testPackageIncludes: [],
    });

    return NextResponse.json({
      offersTestPackage: profile.offersTestPackage,
      testPackageDuration: profile.testPackageDuration,
      testPackageIncludes: profile.testPackageIncludes,
    });
  } catch (error) {
    console.error('Get test package error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Update instructor's test package settings
export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.providerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const data = testPackageSchema.parse(body);

    // Validation: If offering test package, price and duration are required
    if (data.offersTestPackage) {
      if (!data.testPackagePrice || data.testPackagePrice <= 0) {
        return NextResponse.json(
          { error: 'Test package price is required and must be greater than 0' },
          { status: 400 }
        );
      }
      if (!data.testPackageDuration || data.testPackageDuration <= 0) {
        return NextResponse.json(
          { error: 'Test package duration is required and must be greater than 0' },
          { status: 400 }
        );
      }
      if (!data.testPackageIncludes || data.testPackageIncludes.length === 0) {
        return NextResponse.json(
          { error: 'At least one included feature is required' },
          { status: 400 }
        );
      }
    }

    const instructor = await prisma.provider.findUnique({
      where: { id: session!.user!.providerId },
      select: { id: true }
    });
    if (!instructor) return NextResponse.json({ error: 'Provider not found' }, { status: 404 });

    // Test package fields live in DrivingProviderProfile (extension table)
    await upsertDrivingProfile(instructor.id, {
      offersTestPackage: data.offersTestPackage,
      testPackageDuration: data.testPackageDuration,
      testPackageIncludes: data.testPackageIncludes || [],
    });

    return NextResponse.json({
      success: true,
      testPackage: {
        offersTestPackage: data.offersTestPackage,
        testPackageDuration: data.testPackageDuration,
        testPackageIncludes: data.testPackageIncludes || [],
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error('Update test package error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
