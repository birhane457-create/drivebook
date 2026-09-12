-- Migration: add_accepting_bookings
-- Fix #14: Instructor self-service booking pause toggle.
-- Adds acceptingBookings column to Instructor table.
-- Defaults to TRUE so all existing instructors remain visible and bookable
-- without any data migration required.

ALTER TABLE "Instructor" ADD COLUMN IF NOT EXISTS "acceptingBookings" BOOLEAN NOT NULL DEFAULT true;
