-- AUDIT FIX #16: Fix Historical Package Booking Prices
-- Corrects package bookings where price was incorrectly set to packageTotalPaid
-- Run this ONCE on production database after deploying Fix #13

-- 1. Preview affected bookings (run this first to see what will change)
SELECT 
  id,
  isPackageBooking,
  price AS current_price,
  packageTotalPaid,
  lockedHourlyRate,
  duration,
  (lockedHourlyRate * duration / 60) AS calculated_correct_price,
  (price - (lockedHourlyRate * duration / 60)) AS difference,
  createdAt
FROM Booking
WHERE isPackageBooking = true
  AND price = packageTotalPaid
  AND lockedHourlyRate IS NOT NULL
  AND packageTotalPaid IS NOT NULL
ORDER BY createdAt DESC;

-- 2. Apply fix (uncomment to execute)
/*
UPDATE Booking
SET price = (lockedHourlyRate * duration / 60)
WHERE isPackageBooking = true
  AND price = packageTotalPaid
  AND lockedHourlyRate IS NOT NULL
  AND packageTotalPaid IS NOT NULL;
*/

-- 3. Verify fix was applied
/*
SELECT COUNT(*) AS fixed_count
FROM Booking
WHERE isPackageBooking = true
  AND lockedHourlyRate IS NOT NULL
  AND packageTotalPaid IS NOT NULL
  AND price != packageTotalPaid
  AND price = (lockedHourlyRate * duration / 60);
*/
