import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

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
    
    if (!session?.user?.instructorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const instructor = await prisma.instructor.findUnique({
      where: { id: session.user.instructorId },
      select: {
        offersTestPackage: true,
        testPackagePrice: true,
        testPackageDuration: true,
        testPackageIncludes: true
      }
    });

    if (!instructor) {
      return NextResponse.json({ error: 'Instructor not found' }, { status: 404 });
    }

    return NextResponse.json(instructor);
  } catch (error) {
    console.error('Get test package error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Update instructor's test package settings
export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.instructorId) {
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

    const instructor = await prisma.instructor.update({
      where: { id: session.user.instructorId },
      data: {
        offersTestPackage: data.offersTestPackage,
        testPackagePrice: data.testPackagePrice,
        testPackageDuration: data.testPackageDuration,
        testPackageIncludes: data.testPackageIncludes || []
      },
      select: {
        offersTestPackage: true,
        testPackagePrice: true,
        testPackageDuration: true,
        testPackageIncludes: true
      }
    });

    return NextResponse.json({
      success: true,
      testPackage: instructor
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error('Update test package error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
