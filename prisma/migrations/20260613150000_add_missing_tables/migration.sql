-- CreateTable SlotReservation
CREATE TABLE "SlotReservation" (
    "id" TEXT NOT NULL,
    "instructorId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SlotReservation_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey for SlotReservation
ALTER TABLE "SlotReservation" ADD CONSTRAINT "SlotReservation_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "Instructor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex for SlotReservation
CREATE INDEX "SlotReservation_instructorId_expiresAt_idx" ON "SlotReservation"("instructorId", "expiresAt");
CREATE INDEX "SlotReservation_sessionId_idx" ON "SlotReservation"("sessionId");
