-- CreateTable
CREATE TABLE "DrivingProviderProfile" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "carMake" TEXT,
    "carModel" TEXT,
    "carYear" TEXT,
    "vehicleTypes" TEXT,
    "carImage" TEXT,
    "vehicleRegistrationDoc" TEXT,
    "licenseNumber" TEXT,
    "licenseExpiry" TIMESTAMP(3),
    "licenseImageFront" TEXT,
    "licenseImageBack" TEXT,
    "insuranceNumber" TEXT,
    "insuranceExpiry" TIMESTAMP(3),
    "insurancePolicyDoc" TEXT,
    "policeCheckDoc" TEXT,
    "policeCheckExpiry" TIMESTAMP(3),
    "wwcCheckDoc" TEXT,
    "wwcCheckExpiry" TIMESTAMP(3),
    "certificationDoc" TEXT,
    "photoIdDoc" TEXT,
    "offersTestPackage" BOOLEAN NOT NULL DEFAULT false,
    "testPackageDuration" INTEGER,
    "testPackageIncludes" JSONB,
    "testPackagePrice" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DrivingProviderProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrivingLessonOutcome" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "assessmentType" TEXT NOT NULL DEFAULT 'COACHING',
    "lessonTopics" TEXT,
    "pdaScores" JSONB,
    "passed" BOOLEAN,
    "performanceScore" INTEGER,
    "studentStrengths" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "focusAreas" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "lessonFeedback" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "instructorNotes" TEXT,
    "whiteboardSketchUrl" TEXT,
    "feedbackGivenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DrivingLessonOutcome_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DrivingProviderProfile_providerId_key" ON "DrivingProviderProfile"("providerId");

-- CreateIndex
CREATE INDEX "DrivingProviderProfile_providerId_idx" ON "DrivingProviderProfile"("providerId");

-- CreateIndex
CREATE UNIQUE INDEX "DrivingLessonOutcome_bookingId_key" ON "DrivingLessonOutcome"("bookingId");

-- CreateIndex
CREATE INDEX "DrivingLessonOutcome_bookingId_idx" ON "DrivingLessonOutcome"("bookingId");
