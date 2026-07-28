'use strict';

/**
 * validators.js
 *
 * Zod schemas for validating input to the drivebook-hybrid service.
 * Used by booking-api.js (local SQLite booking endpoint) and instructor-service.js.
 *
 * Note: The main Vapi booking flow goes through main-app-proxy.js directly to
 * the main DriveBook app, which has its own validation. These schemas apply to
 * the legacy local booking endpoint only.
 */

const { z } = require('zod');

// ── Business hours ────────────────────────────────────────────────────────────
// Lessons can be booked between 08:00 and 19:59 (last slot starts at 19:00).
// Change these constants when business rules change — do not hardcode inline.
const BUSINESS_HOUR_START = 8;   // inclusive (08:xx)
const BUSINESS_HOUR_END   = 20;  // exclusive (< 20:00)

//  Phone 
// Strips all non-digit characters except the leading + before validating.
// Accepts Australian (04xx, +614xx) and international E.164 formats.
// Handles common formats from Vapi and callers: spaces, dashes, parentheses.
const phoneSchema = z
  .string()
  .transform((s) => {
    const digits = s.replace(/[\s\-().]/g, '');
    if (digits.startsWith('614')) return '+' + digits;
    if (digits.startsWith('04')) return '+61' + digits.slice(1);
    if (s.startsWith('+')) return '+' + digits;
    return digits;
  })
  .refine((p) => /^\+?\d{9,15}$/.test(p), {
    message: 'Invalid phone number - must be 9-15 digits, optionally prefixed with +',
  });

//  Vehicle type 
// Accepts the two canonical DB values (AUTO, MANUAL) plus common voice/UI variants.
// Normalises to the DB canonical form.
const vehicleTypeSchema = z
  .string()
  .transform((s) => s.trim().toUpperCase())
  .transform((s) => {
    if (s === 'AUTOMATIC' || s === 'AUTO') return 'AUTO';
    if (s === 'MANUAL')                    return 'MANUAL';
    return s;
  })
  .refine((s) => ['AUTO', 'MANUAL'].includes(s), {
    message: "vehicleType must be 'AUTO' or 'MANUAL'",
  });

//  Date 
// Accepts YYYY-MM-DD. Validates the date is today or in the future.
const dateSchema = z
  .string()
  .refine((s) => /^\d{4}-\d{2}-\d{2}$/.test(s), {
    message: 'Date must be in YYYY-MM-DD format',
  })
  .refine(
    (s) => {
      const today = new Date().toLocaleDateString('sv-SE'); // sv-SE yields YYYY-MM-DD
      return s >= today;
    },
    { message: 'Date must be today or in the future' }
  );

//  Time 
// Accepts HH:MM in 24-hour format, constrained to business hours.
const timeSchema = z
  .string()
  .refine((s) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s), {
    message: 'Time must be in HH:MM 24-hour format',
  })
  .refine(
    (s) => {
      const hour = parseInt(s.split(':')[0], 10);
      return hour >= BUSINESS_HOUR_START && hour < BUSINESS_HOUR_END;
    },
    {
      message: `Time must be within business hours (${String(BUSINESS_HOUR_START).padStart(2, '0')}:00 - ${String(BUSINESS_HOUR_END - 1).padStart(2, '0')}:59)`,
    }
  );

//  Name 
// Accepts names with Latin letters, Unicode letters, spaces, hyphens, apostrophes, and dots.
const nameSchema = z
  .string()
  .min(2, { message: 'Name must be at least 2 characters' })
  .max(80, { message: 'Name must be 80 characters or fewer' })
  .regex(/^[\p{L}\s'.,-]+$/u, {
    message: 'Name contains invalid characters',
  });

//  Booking (local SQLite endpoint - booking-api.js) 
// Used by POST /api/bookings — the legacy local booking route.
// The Vapi createBooking tool uses POST /api/public/bookings/bulk via the proxy,
// which is validated by the main DriveBook application.
const bookingSchema = z.object({
  instructorId: z.string().min(1, { message: 'instructorId is required' }),
  clientName:   nameSchema,
  clientPhone:  phoneSchema,
  date:         dateSchema,
  time:         timeSchema,
  duration:     z.number().int().min(30).max(480),
});

module.exports = { phoneSchema, dateSchema, timeSchema, nameSchema, vehicleTypeSchema, bookingSchema };