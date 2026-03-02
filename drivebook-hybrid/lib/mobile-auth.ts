import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { prisma } from './prisma';

interface TokenPayload {
  userId: string;
  email: string;
  role: string;
  instructorId?: string;
}

export async function validateMobileToken(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    
    if (!authHeader?.startsWith('Bearer ')) {
      return {
        valid: false,
        error: 'Missing or invalid authorization header',
        user: null,
      };
    }

    const token = authHeader.slice(7); // Remove 'Bearer ' prefix

    // Verify token
    const decoded = jwt.verify(
      token,
      process.env.NEXTAUTH_SECRET || 'your-secret-key'
    ) as TokenPayload;

    // Get user from database to ensure they still exist
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        role: true,
      },
    });

    if (!user) {
      return {
        valid: false,
        error: 'User not found',
        user: null,
      };
    }

    return {
      valid: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        userId: decoded.userId,
      },
      error: null,
    };
  } catch (error) {
    console.error('Token validation error:', error);
    return {
      valid: false,
      error: 'Invalid token',
      user: null,
    };
  }
}

export function createUnauthorizedResponse() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

export function createForbiddenResponse() {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
