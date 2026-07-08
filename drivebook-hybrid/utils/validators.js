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

//  Phone 
// Strips all non-digit characters except the leading + before validating.
// Accepts Australian (04xx, +614xx) and international E.164 formats.
// Handles common formats from Vapi and callers: spaces, dashes, parentheses.
const phoneSchema = z
  .string()
  .transform((s) => s.replace(/[\s\-().]/g, ''))  // strip spaces, dashes, parens, dots
  .refine((p) => /^\+?\d{9,15}$/.test(p), {
    message: 'Invalid phone number  must be 915 digits, optionally prefixed with +',
  });

//  Date 
// Accepts YYYY-MM-DD. Validates the date is today or in the future.
// Comparison is done on date strings (YYYY-MM-DD) in local timezone to avoid
// UTC midnight shifting issues where "today" in AWST could be "yesterday" in UTC.
const dateSchema = z
  .string()
  .refine((s) => /^\d{4}-\d{2}-\d{2}$/.test(s), {
    message: 'Date must be in YYYY-MM-DD format',
  })
  .refine(
    (s) => {
      // Compare as YYYY-MM-DD strings  avoids UTC vs local timezone ambiguity
      const today = new Date().toLocaleDateString('sv-SE'); // sv-SE gives YYYY-MM-DD
      return s >= today;
    },
    { message: 'Date must be today or in the future' }
  );

//  Time 
// Accepts HH:MM in 24-hour format. Business hours: 08:0019:59.
// The hour is parsed as an integer to avoid string comparison bugs.
const timeSchema = z
  .string()
  .refine((s) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s), {
    message: 'Time must be in HH:MM 24-hour format',
  })
  .refine(
    (s) => {
      const hour = parseInt(s.split(':')[0], 10); // explicit parseInt  avoid string coercion
      return hour >= 8 && hour < 20;
    },
    { message: 'Time must be within business hours (08:0019:59)' }
  );

//  Name 
// Accepts names with Latin letters, Unicode letters (covers Vietnamese, Chinese
// romanisation, accented characters), spaces, hyphens, apostrophes, and dots.
// Min 2 chars, max 80 chars to prevent absurdly long inputs.
const nameSchema = z
  .string()
  .min(2, { message: 'Name must be at least 2 characters' })
  .max(80, { message: 'Name must be 80 characters or fewer' })
  .regex(/^[\p{L}\s'.,-]+$/u, {
    message: 'Name contains invalid characters',
  });

//  Booking (local SQLite endpoint  booking-api.js) 
// Used by POST /api/bookings  the legacy local booking route.
// The Vapi createBooking tool uses POST /api/public/bookings/bulk via the proxy,
// which is validated by the main DriveBook application.
const bookingSchema = z.object({
  instructorId: z.string().min(1, { message: 'instructorId is required' }),
  clientName:   nameSchema,
  clientPhone:  phoneSchema,
  date:         dateSchema,
  time:         timeSchema,
  duration:     z.number().int().min(30).max(480), // 30 min minimum, 8 hours maximum
});

module.exports = { phoneSchema, dateSchema, timeSchema, nameSchema, bookingSchema };