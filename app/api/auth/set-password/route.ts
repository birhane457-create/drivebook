import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const schema = z.object({
  token: z.string(),
  password: z.string().min(8),
  // email is accepted for display/UX purposes only — it is NOT written to the DB here.
  // Email changes must go through the authenticated account settings flow (requires current password).
  // Allowing email changes via a reset token would let anyone with a leaked token permanently
  // take over the account by changing the email before the real owner notices.
  email: z.string().email().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, password } = schema.parse(body);

    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: { gt: new Date() },
      },
      select: { id: true, email: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'Invalid or expired link. Please contact support.' }, { status: 404 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Only update the password and clear the token — never change email via this route.
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null,
        // email intentionally omitted — use authenticated /api/account/change-email instead
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', issues: err.issues }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to set password' }, { status: 500 });
  }
}
