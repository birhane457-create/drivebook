/**
 * DEPRECATED — use /api/payments/wallet or /api/payments/create-intent instead.
 *
 * Wallet top-up:   POST /api/client/wallet-topup-intent  (min/max enforced, rate-limited)
 * Booking payment: POST /api/payments/create-intent      (server-side price, advisory lock)
 *
 * This file is kept as a tombstone so any stale client code gets a clear error
 * instead of silently failing.
 */

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST() {
  return NextResponse.json(
    {
      error: 'This endpoint is deprecated.',
      walletTopUp: 'POST /api/client/wallet-topup-intent',
      bookingPayment: 'POST /api/payments/create-intent',
    },
    { status: 410 } // 410 Gone — not a temporary redirect
  );
}
