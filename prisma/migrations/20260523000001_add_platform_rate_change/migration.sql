-- AddTable: PlatformRateChange
-- Safe additive migration — creates a new table, touches nothing existing

CREATE TABLE "PlatformRateChange" (
    "id"            TEXT NOT NULL,
    "tier"          TEXT NOT NULL,
    "field"         TEXT NOT NULL,
    "currentRate"   DOUBLE PRECISION NOT NULL,
    "newRate"       DOUBLE PRECISION NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "reason"        TEXT NOT NULL,
    "status"        TEXT NOT NULL DEFAULT 'PENDING',
    "notifiedAt"    TIMESTAMP(3),
    "appliedAt"     TIMESTAMP(3),
    "createdBy"     TEXT NOT NULL,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformRateChange_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PlatformRateChange_status_effectiveDate_idx"
    ON "PlatformRateChange"("status", "effectiveDate");
