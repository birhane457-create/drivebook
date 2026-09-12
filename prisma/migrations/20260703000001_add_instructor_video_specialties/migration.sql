-- AddColumn: videoUrl and specialties on Instructor
-- Instructor-configurable profile content fields

ALTER TABLE "Instructor" ADD COLUMN IF NOT EXISTS "videoUrl" TEXT;
ALTER TABLE "Instructor" ADD COLUMN IF NOT EXISTS "specialties" TEXT;
