import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/register
 *
 * Bootstrap endpoint — creates the first SUPER_ADMIN account.
 * Protected by ADMIN_BOOTSTRAP_KEY env var.
 * Disabled once any SUPER_ADMIN exists.
 *
 * Preferred method: use `node create-admin.js` instead of this endpoint.
 */
export async function POST(req: NextRequest) {
  try {
    // Must provide bootstrap key
    const bootstrapKey = process.env.ADMIN_BOOTSTRAP_KEY;
    if (!bootstrapKey) {
      return NextResponse.json({ error: 'Admin registration is disabled' }, { status: 403 });
    }

    const { email, password, bootstrapKey: providedKey } = await req.json();

    if (providedKey !== bootstrapKey) {
      return NextResponse.json({ error: 'Invalid bootstrap key' }, { status: 403 });
    }

    if (!email || !password || password.length < 8) {
      return NextResponse.json({ error: 'Email and password (min 8 chars) required' }, { status: 400 });
    }

    // Only allow if no SUPER_ADMIN exists yet
    const existingAdmin = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } });
    if (existingAdmin) {
      return NextResponse.json({ error: 'Admin account already exists' }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 400 });
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, password: hashed, role: 'SUPER_ADMIN' },
    });

    return NextResponse.json({ message: 'Admin created', userId: user.id, email: user.email }, { status: 201 });
  } catch (error) {
    console.error('Admin registration error:', error);
    return NextResponse.json({ error: 'Failed to create admin account' }, { status: 500 });
  }
}
