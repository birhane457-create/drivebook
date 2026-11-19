ALTER TABLE "PDATestBooking"
  ADD COLUMN "walletTransactionId" TEXT,
  ADD COLUMN "financialStatus" TEXT NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'AUD';

CREATE INDEX "PDATestBooking_walletTransactionId_idx"
  ON "PDATestBooking"("walletTransactionId");
CREATE INDEX "PDATestBooking_financialStatus_idx"
  ON "PDATestBooking"("financialStatus");

ALTER TABLE "FinancialLedger"
  ADD COLUMN "pdaBookingId" TEXT,
  ADD COLUMN "pdaRefundId" TEXT,
  ADD COLUMN "walletTransactionId" TEXT,
  ADD COLUMN "customerId" TEXT,
  ADD COLUMN "entryType" TEXT NOT NULL DEFAULT 'GENERAL',
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'POSTED',
  ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'AUD';

CREATE INDEX "FinancialLedger_pdaBookingId_idx"
  ON "FinancialLedger"("pdaBookingId");
CREATE INDEX "FinancialLedger_pdaRefundId_idx"
  ON "FinancialLedger"("pdaRefundId");
CREATE INDEX "FinancialLedger_walletTransactionId_idx"
  ON "FinancialLedger"("walletTransactionId");
CREATE INDEX "FinancialLedger_customerId_idx"
  ON "FinancialLedger"("customerId");

CREATE TABLE "PDARefund" (
  "id" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "pdaBookingId" TEXT NOT NULL,
  "originalWalletTransactionId" TEXT NOT NULL,
  "refundWalletTransactionId" TEXT,
  "amount" DECIMAL(12, 2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'AUD',
  "reason" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PDARefund_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PDARefund_idempotencyKey_key"
  ON "PDARefund"("idempotencyKey");
CREATE UNIQUE INDEX "PDARefund_refundWalletTransactionId_key"
  ON "PDARefund"("refundWalletTransactionId");
CREATE INDEX "PDARefund_pdaBookingId_createdAt_idx"
  ON "PDARefund"("pdaBookingId", "createdAt");
CREATE INDEX "PDARefund_originalWalletTransactionId_idx"
  ON "PDARefund"("originalWalletTransactionId");

ALTER TABLE "PDATestBooking"
  ADD CONSTRAINT "PDATestBooking_walletTransactionId_fkey"
  FOREIGN KEY ("walletTransactionId") REFERENCES "WalletTransaction"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PDARefund"
  ADD CONSTRAINT "PDARefund_pdaBookingId_fkey"
  FOREIGN KEY ("pdaBookingId") REFERENCES "PDATestBooking"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "PDARefund_originalWalletTransactionId_fkey"
  FOREIGN KEY ("originalWalletTransactionId") REFERENCES "WalletTransaction"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "PDARefund_refundWalletTransactionId_fkey"
  FOREIGN KEY ("refundWalletTransactionId") REFERENCES "WalletTransaction"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "FinancialLedger"
  ADD CONSTRAINT "FinancialLedger_pdaBookingId_fkey"
  FOREIGN KEY ("pdaBookingId") REFERENCES "PDATestBooking"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "FinancialLedger_pdaRefundId_fkey"
  FOREIGN KEY ("pdaRefundId") REFERENCES "PDARefund"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "FinancialLedger_walletTransactionId_fkey"
  FOREIGN KEY ("walletTransactionId") REFERENCES "WalletTransaction"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "FinancialLedger_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
