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

    const hashed = await bcrypt.hash(password, 10);

    // Atomic guard: the SERIALIZABLE transaction ensures that two concurrent requests
    // cannot both pass the no-SUPER_ADMIN check and both create an account.
    // The transaction re-checks for an existing admin inside the lock before creating.
    try {
      const user = await prisma.$transaction(async (tx) => {
        const existingAdmin = await tx.user.findFirst({ where: { role: 'SUPER_ADMIN' } });
        if (existingAdmin) {
          throw Object.assign(new Error('ALREADY_EXISTS'), { code: 'ALREADY_EXISTS' });
        }
        const existingEmail = await tx.user.findUnique({ where: { email } });
        if (existingEmail) {
          throw Object.assign(new Error('EMAIL_TAKEN'), { code: 'EMAIL_TAKEN' });
        }
        return tx.user.create({
          data: { email, password: hashed, role: 'SUPER_ADMIN' },
        });
      }, { isolationLevel: 'Serializable' });

      return NextResponse.json({ message: 'Admin created', userId: user.id, email: user.email }, { status: 201 });
    } catch (txErr: any) {
      if (txErr.code === 'ALREADY_EXISTS') {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
      if (txErr.code === 'EMAIL_TAKEN') {
        return NextResponse.json({ error: 'Email already registered' }, { status: 400 });
      }
      throw txErr;
    }
  } catch (error) {
    console.error('Admin registration error:', error);
    return NextResponse.json({ error: 'Failed to create admin account' }, { status: 500 });
  }
}
