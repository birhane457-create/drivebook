import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';


export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Normalize email: lowercase and trim
    const normalizedEmail = email.toLowerCase().trim();

    // Check if user exists in database
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    });

    return NextResponse.json({
      exists: !!existingUser,
      email: normalizedEmail
    });
  } catch (error) {
    console.error('Error checking email:', error);
    return NextResponse.json(
      { error: 'Failed to check email' },
      { status: 500 }
    );
  }
}
