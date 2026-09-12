-- D7: Remove driving-specific fields from core Instructor and Booking tables
-- These fields have been migrated to DrivingProviderProfile and DrivingLessonOutcome
-- extension tables (Phase 2B). All application code now reads from extension tables.

-- AlterTable: Remove driving outcome fields from Booking
ALTER TABLE "Booking" DROP COLUMN IF EXISTS "assessmentType",
DROP COLUMN IF EXISTS "feedbackGivenAt",
DROP COLUMN IF EXISTS "focusAreas",
DROP COLUMN IF EXISTS "instructorNotes",
DROP COLUMN IF EXISTS "lessonFeedback",
DROP COLUMN IF EXISTS "lessonTopics",
DROP COLUMN IF EXISTS "passed",
DROP COLUMN IF EXISTS "performanceScore",
DROP COLUMN IF EXISTS "studentStrengths",
DROP COLUMN IF EXISTS "whiteboardSketchUrl";

-- AlterTable: Remove driving profile fields from Instructor
ALTER TABLE "Instructor" DROP COLUMN IF EXISTS "carMake",
DROP COLUMN IF EXISTS "carModel",
DROP COLUMN IF EXISTS "carYear",
DROP COLUMN IF EXISTS "certificationDoc",
DROP COLUMN IF EXISTS "insuranceExpiry",
DROP COLUMN IF EXISTS "insuranceNumber",
DROP COLUMN IF EXISTS "insurancePolicyDoc",
DROP COLUMN IF EXISTS "licenseExpiry",
DROP COLUMN IF EXISTS "licenseImageBack",
DROP COLUMN IF EXISTS "licenseImageFront",
DROP COLUMN IF EXISTS "licenseNumber",
DROP COLUMN IF EXISTS "offersTestPackage",
DROP COLUMN IF EXISTS "photoIdDoc",
DROP COLUMN IF EXISTS "policeCheckDoc",
DROP COLUMN IF EXISTS "policeCheckExpiry",
DROP COLUMN IF EXISTS "testPackageDuration",
DROP COLUMN IF EXISTS "testPackageIncludes",
DROP COLUMN IF EXISTS "testPackagePrice",
DROP COLUMN IF EXISTS "vehicleRegistrationDoc",
DROP COLUMN IF EXISTS "wwcCheckDoc",
DROP COLUMN IF EXISTS "wwcCheckExpiry";
