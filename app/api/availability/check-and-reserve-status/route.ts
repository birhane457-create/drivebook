// Check if a reserved slot is still valid (before payment)
// Called by payment page to show countdown timer and status

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

interface CheckSlotStatusRequest {
  slotId: string;
  sessionId: string; // Must match the reservation owner
  instructorId: string;
  startTime: string; // ISO timestamp
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as CheckSlotStatusRequest;
    const { slotId, sessionId, instructorId, startTime } = body;

    if (!sessionId || !slotId) {
      return NextResponse.json(
        { error: 'Missing sessionId or slotId' },
        { status: 400 }
      );
    }

    // Check if slot reservation still exists and is valid
    const reservation = await prisma.slotReservation.findUnique({
      where: { id: slotId },
    });

    if (!reservation) {
      // Slot doesn't exist (was already used or deleted)
      return NextResponse.json({
        status: 'NOT_FOUND',
        message: 'Slot reservation no longer exists',
        action: 'SELECT_NEW_SLOT', // User must pick a different time
        slotExpiredAt: new Date().toISOString(),
      }, { status: 410 }); // 410 Gone
    }

    // Check if reservation belongs to this session
    if (reservation.sessionId !== sessionId) {
      logger.warn('Session mismatch on slot status check', {
        slotId,
        reservedBy: reservation.sessionId,
        requestedBy: sessionId,
      });
      return NextResponse.json(
        { error: 'Slot reserved by different session' },
        { status: 403 }
      );
    }

    // Check if slot is expired
    const now = new Date();
    const expiresAt = new Date(reservation.expiresAt);
    const isExpired = now > expiresAt;

    if (isExpired) {
      // Slot expired - auto delete it and inform user
      await prisma.slotReservation.delete({
        where: { id: slotId },
      });

      logger.info('Slot reservation expired', {
        slotId,
        instructorId,
        expiredAt: expiresAt.toISOString(),
        sessionId,
      });

      return NextResponse.json({
        status: 'EXPIRED',
        message: 'Your slot reservation expired (10 minutes without payment)',
        action: 'SELECT_NEW_SLOT', // Must pick new time
        slotExpiredAt: expiresAt.toISOString(),
        remainingSeconds: 0,
      }, { status: 410 }); // 410 Gone
    }

    // Slot is still valid - calculate remaining time
    const remainingMs = expiresAt.getTime() - now.getTime();
    const remainingSeconds = Math.ceil(remainingMs / 1000);
    const remainingMinutes = Math.ceil(remainingSeconds / 60);

    // Warn if less than 2 minutes remaining
    const shouldWarn = remainingSeconds < 120;

    return NextResponse.json({
      status: 'VALID',
      message: `Slot reserved. ${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''} remaining.`,
      action: shouldWarn ? 'HURRY_UP' : 'CONTINUE_PAYMENT',
      remainingSeconds,
      remainingMinutes,
      expiresAt: expiresAt.toISOString(),
      shouldWarn,
      warningMessage: shouldWarn 
        ? 'Your slot expires in less than 2 minutes. Complete payment or select a new time.'
        : null,
    }, { status: 200 });

  } catch (error) {
    logger.error('Slot status check error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Failed to check slot status' },
      { status: 500 }
    );
  }
}
