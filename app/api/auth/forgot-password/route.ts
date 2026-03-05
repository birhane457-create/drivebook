import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { emailService } from '@/lib/services/email';
import crypto from 'crypto';


export const dynamic = 'force-dynamic';
export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    // Always return success to prevent email enumeration
    if (!user) {
      return NextResponse.json({
        success: true,
        message: 'If an account exists with that email, a password reset link has been sent.'
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour from now

    // Save token to database
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken,
        resetTokenExpiry
      } as any
    });

    // Create reset URL
    const resetUrl = `${process.env.NEXTAUTH_URL}/reset-password?token=${resetToken}`;

    // Send email (skip if SMTP not configured)
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      try {
        await (emailService as any).sendPasswordResetEmail({
          email: user.email,
          resetUrl,
          userName: user.email
        });
      } catch (emailError) {
        console.error('Failed to send reset email:', emailError);
        // Continue anyway - token is saved in database
      }
    } else {
      console.log('SMTP not configured, skipping email. Reset URL:', resetUrl);
    }

    return NextResponse.json({
      success: true,
      message: 'If an account exists with that email, a password reset link has been sent.',
      // For development: include reset URL in response (REMOVE IN PRODUCTION!)
      ...(process.env.NODE_ENV === 'development' && { resetUrl })
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    
    // Return more detailed error in development
    const errorMessage = error instanceof Error ? error.message : 'Failed to process request';
    const errorDetails = process.env.NODE_ENV === 'development' 
      ? { error: errorMessage, details: error }
      : { error: 'Failed to process request' };
    
    return NextResponse.json(errorDetails, { status: 500 });
  }
}
