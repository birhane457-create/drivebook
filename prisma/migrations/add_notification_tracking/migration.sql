-- Add notification tracking to Booking table
-- This allows us to track when notifications fail and need retry

-- Add notificationStatus field to track email/SMS/push notification delivery
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "notificationStatus" TEXT DEFAULT 'pending';

-- Add notificationAttempts to track retry count
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "notificationAttempts" INTEGER DEFAULT 0;

-- Add lastNotificationAttempt timestamp
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "lastNotificationAttempt" TIMESTAMP(3);

-- Add notificationFailureReason for debugging
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "notificationFailureReason" TEXT;

-- Create index for querying failed notifications
CREATE INDEX IF NOT EXISTS "Booking_notificationStatus_idx" ON "Booking"("notificationStatus");

-- Add comment for documentation
COMMENT ON COLUMN "Booking"."notificationStatus" IS 'Notification delivery status: pending, sent, failed, partial';
COMMENT ON COLUMN "Booking"."notificationAttempts" IS 'Number of notification delivery attempts';
COMMENT ON COLUMN "Booking"."lastNotificationAttempt" IS 'Timestamp of last notification attempt';
COMMENT ON COLUMN "Booking"."notificationFailureReason" IS 'Reason for notification failure (for debugging)';
