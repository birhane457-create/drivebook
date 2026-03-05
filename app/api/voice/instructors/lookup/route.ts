/**
 * Voice Service: Instructor Lookup by Phone
 * 
 * Used by AI voice receptionist to find instructor by their Twilio phone number
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withVoiceServiceAuth } from '@/lib/middleware/voiceServiceAuth';

export const dynamic = 'force-dynamic';

async function handler(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const phone = searchParams.get('phone');

    if (!phone) {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      );
    }

    // Normalize phone number (remove spaces, dashes, etc.)
    const normalizedPhone = phone.replace(/[\s\-\(\)]/g, '');

    // Find instructor by phone number
    const instructor = await prisma.instructor.findFirst({
      where: {
        OR: [
          { phone: normalizedPhone },
          { phone: phone },
          { twilioPhoneNumber: normalizedPhone },
          { twilioPhoneNumber: phone }
        ],
        approvalStatus: 'APPROVED', // Only return approved instructors
        subscriptionStatus: { in: ['ACTIVE', 'TRIALING'] } // Only active subscriptions
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        hourlyRate: true,
        serviceAreas: true,
        baseLatitude: true,
        baseLongitude: true,
        serviceRadiusKm: true,
        workingHours: true,
        twilioPhoneNumber: true,
        copilotAgentEndpoint: true,
        approvalStatus: true,
        subscriptionStatus: true
      }
    });

    if (!instructor) {
      return NextResponse.json(
        { error: 'Instructor not found' },
        { status: 404 }
      );
    }

    // Return instructor data in voice service format
    return NextResponse.json({
      id: instructor.id,
      name: instructor.name,
      phone: instructor.phone,
      email: instructor.email,
      hourlyRate: instructor.hourlyRate,
      serviceAreas: instructor.serviceAreas || 'Multiple areas',
      baseLatitude: instructor.baseLatitude,
      baseLongitude: instructor.baseLongitude,
      serviceRadiusKm: instructor.serviceRadiusKm,
      workingHours: instructor.workingHours,
      copilotAgentEndpoint: instructor.copilotAgentEndpoint,
      available: instructor.approvalStatus === 'APPROVED' && 
                 ['ACTIVE', 'TRIALING'].includes(instructor.subscriptionStatus || '')
    });

  } catch (error) {
    console.error('Voice service instructor lookup error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export const GET = withVoiceServiceAuth(handler);
