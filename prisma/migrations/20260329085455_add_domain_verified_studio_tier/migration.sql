-- AlterTable
ALTER TABLE "Instructor" ADD COLUMN     "domainVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "domainVerifiedAt" TIMESTAMP(3);
