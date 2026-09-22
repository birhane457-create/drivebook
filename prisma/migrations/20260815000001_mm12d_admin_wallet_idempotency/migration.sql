-- MM-12-D: Admin wallet idempotency key store
-- Implements claim-first idempotency for admin add-credit and deduct-credit routes.
-- See docs/audit/MM-12-C_DESIGN_VERIFICATION.md for full design rationale.
--
-- The composite unique constraint (key, walletId, operationType) is the
-- database-level serialisation point that prevents concurrent duplicate
-- financial effects. PostgreSQL acquires a row-level lock on the tuple at
-- INSERT time; a concurrent INSERT of the same key blocks until the first
-- transaction commits or rolls back.
--
-- transactionId and response are nullable — they are NULL while the financial
-- operation is in-flight and populated atomically by the UPDATE at commit.

CREATE TABLE "AdminWalletIdempotencyKey" (
    "key"           TEXT          NOT NULL,
    "walletId"      TEXT          NOT NULL,
    "operationType" TEXT          NOT NULL,   -- 'CREDIT' | 'DEBIT'
    "transactionId" TEXT,                     -- WalletTransaction.id (null while in-flight)
    "response"      JSONB,                    -- stored response body (null while in-flight)
    "createdAt"     TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt"     TIMESTAMP(3)  NOT NULL,

    CONSTRAINT "AdminWalletIdempotencyKey_pkey"
        PRIMARY KEY ("key")
);

-- Composite unique constraint — the serialisation point
CREATE UNIQUE INDEX "AdminWalletIdempotencyKey_key_walletId_opType_key"
    ON "AdminWalletIdempotencyKey"("key", "walletId", "operationType");

-- TTL cleanup index
CREATE INDEX "AdminWalletIdempotencyKey_expiresAt_idx"
    ON "AdminWalletIdempotencyKey"("expiresAt");

-- Wallet-level lookup index
CREATE INDEX "AdminWalletIdempotencyKey_walletId_idx"
    ON "AdminWalletIdempotencyKey"("walletId");
