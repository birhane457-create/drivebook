-- PH5-SCH-22b: Partial unique index on Payout.stripeTransferId
--
-- Enforces that no two payouts can record the same Stripe transfer ID.
-- NULL values are explicitly excluded: a payout that has not yet been
-- linked to a Stripe transfer may coexist with other unlinked payouts.
--
-- This is a partial (filtered) unique index. PostgreSQL treats NULL values
-- as distinct in unique indexes by default, so this explicit WHERE clause
-- documents intent and ensures the constraint is applied only to settled
-- transfer IDs — not to in-flight or unrecovered payouts.
--
-- Pre-condition: verified zero duplicate non-null stripeTransferId rows
-- in production (Sydney: jflrqxigfiiqednfacuf) before applying.
-- See scripts/check-transfer-id-duplicates.mjs.

CREATE UNIQUE INDEX "Payout_stripeTransferId_unique"
ON "Payout" ("stripeTransferId")
WHERE "stripeTransferId" IS NOT NULL;
