-- Migration: add_booking_idempotency_key
-- Implements idempotency for POST /api/public/bookings/bulk.
-- Callers send an Idempotency-Key header; the server stores the key and
-- response on first success and replays the stored response on any retry,
-- preventing duplicate bookings from Twilio retries, browser double-clicks,
-- AI retries, or network timeouts.

CREATE TABLE IF NOT EXISTS "BookingIdempotencyKey" (
    "key"       TEXT        NOT NULL,
    "bookingId" TEXT        NOT NULL,
    "response"  JSONB       NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingIdempotencyKey_pkey" PRIMARY KEY ("key")
);

CREATE INDEX IF NOT EXISTS "BookingIdempotencyKey_createdAt_idx"
    ON "BookingIdempotencyKey"("createdAt");
