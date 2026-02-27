import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';

// Pricing configuration
const PRICING = {
  PRO: {
    monthlyPrice: 49,
    commissionRate: 12,
    features: [
      'Unlimited bookings',
      'Client management',
      'Calendar integration',
      'SMS notifications',
      'Basic analytics',
      'Mobile app access',
    ],
  },
  BUSINESS: {
    monthlyPrice: 99,
    commissionRate: 8,
    features: [
      'Everything in PRO',
      'Priority support',
      'Advanced analytics',
      'Custom branding',
      'API access',
      'Dedicated account manager',
    ],
  },
};

const NEW_STUDENT_BONUS = 8; // Additional % on first booking with new client

export async function GET(req: NextRequest) {
  try {
    // JWT authentication
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.NEXTAUTH_SECRET!) as {
        userId: string;
        role: string;
        instructorId?: string;
      };
    } catch (error) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Allow INSTRUCTOR or SUPER_ADMIN roles
    if (!decoded.instructorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    
    if (decoded.role !== 'INSTRUCTOR' && decoded.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Get instructor data
    const instructor = await prisma.instructor.findUnique({
      where: { id: decoded.instructorId },
      select: {
        id: true,
        name: true,
      },
    });

    if (!instructor) {
      return NextResponse.json({ error: 'Instructor not found' }, { status: 404 });
    }

    // Mock subscription data (implement when Subscription model is added to schema)
    const subscriptionTier = 'PRO';
    const subscriptionStatus = 'ACTIVE';

    return NextResponse.json({
      current: {
        tier: subscriptionTier,
        status: subscriptionStatus,
        commissionRate: PRICING.PRO.commissionRate,
        newStudentBonus: NEW_STUDENT_BONUS,
        subscription: {
          monthlyAmount: PRICING[subscriptionTier].monthlyPrice,
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          trialEndsAt: null,
          cancelAtPeriodEnd: false,
        },
      },
      pricing: PRICING,
    });
  } catch (error) {
    console.error('Subscription GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    // JWT authentication
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.NEXTAUTH_SECRET!) as {
        userId: string;
        role: string;
        instructorId?: string;
      };
    } catch (error) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Allow INSTRUCTOR or SUPER_ADMIN roles
    if (!decoded.instructorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    
    if (decoded.role !== 'INSTRUCTOR' && decoded.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { tier } = await req.json();

    if (!tier || !['PRO', 'BUSINESS'].includes(tier)) {
      return NextResponse.json({ error: 'Invalid tier' }, { status: 400 });
    }

    // Mock tier change (implement when Subscription model is added to schema)
    // For now, just return success
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Subscription POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    // JWT authentication
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.NEXTAUTH_SECRET!) as {
        userId: string;
        role: string;
        instructorId?: string;
      };
    } catch (error) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Allow INSTRUCTOR or SUPER_ADMIN roles
    if (!decoded.instructorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    
    if (decoded.role !== 'INSTRUCTOR' && decoded.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Mock cancellation (implement when Subscription model is added to schema)
    // For now, just return success
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Subscription DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
