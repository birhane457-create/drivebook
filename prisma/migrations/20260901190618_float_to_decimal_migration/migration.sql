-- Float to Decimal Migration for Financial Fields
-- This migration converts all financial amounts from Float to Decimal for exact precision

-- ProviderExpense
ALTER TABLE "ProviderExpense" ALTER COLUMN "amount" TYPE DECIMAL(12,2) USING "amount"::DECIMAL(12,2);

-- PlatformRateChange
ALTER TABLE "PlatformRateChange" ALTER COLUMN "currentRate" TYPE DECIMAL(10,4) USING "currentRate"::DECIMAL(10,4);
ALTER TABLE "PlatformRateChange" ALTER COLUMN "newRate" TYPE DECIMAL(10,4) USING "newRate"::DECIMAL(10,4);

-- Booking
ALTER TABLE "Booking" ALTER COLUMN "price" TYPE DECIMAL(12,2) USING "price"::DECIMAL(12,2);
ALTER TABLE "Booking" ALTER COLUMN "platformFee" TYPE DECIMAL(12,2) USING "platformFee"::DECIMAL(12,2);
ALTER TABLE "Booking" ALTER COLUMN "providerPayout" TYPE DECIMAL(12,2) USING "providerPayout"::DECIMAL(12,2);
ALTER TABLE "Booking" ALTER COLUMN "commissionRate" TYPE DECIMAL(5,4) USING "commissionRate"::DECIMAL(5,4);
ALTER TABLE "Booking" ALTER COLUMN "packageHours" TYPE DECIMAL(8,2) USING "packageHours"::DECIMAL(8,2);
ALTER TABLE "Booking" ALTER COLUMN "packageHoursUsed" TYPE DECIMAL(8,2) USING "packageHoursUsed"::DECIMAL(8,2);
ALTER TABLE "Booking" ALTER COLUMN "packageHoursRemaining" TYPE DECIMAL(8,2) USING "packageHoursRemaining"::DECIMAL(8,2);
ALTER TABLE "Booking" ALTER COLUMN "packageTotalPaid" TYPE DECIMAL(12,2) USING "packageTotalPaid"::DECIMAL(12,2);
ALTER TABLE "Booking" ALTER COLUMN "lockedDiscountPct" TYPE DECIMAL(5,2) USING "lockedDiscountPct"::DECIMAL(5,2);
ALTER TABLE "Booking" ALTER COLUMN "lockedHourlyRate" TYPE DECIMAL(10,2) USING "lockedHourlyRate"::DECIMAL(10,2);
ALTER TABLE "Booking" ALTER COLUMN "offlineAmountPaid" TYPE DECIMAL(12,2) USING "offlineAmountPaid"::DECIMAL(12,2);

-- Transaction
ALTER TABLE "Transaction" ALTER COLUMN "amount" TYPE DECIMAL(12,2) USING "amount"::DECIMAL(12,2);
ALTER TABLE "Transaction" ALTER COLUMN "platformFee" TYPE DECIMAL(12,2) USING "platformFee"::DECIMAL(12,2);
ALTER TABLE "Transaction" ALTER COLUMN "providerPayout" TYPE DECIMAL(12,2) USING "providerPayout"::DECIMAL(12,2);
ALTER TABLE "Transaction" ALTER COLUMN "commissionRate" TYPE DECIMAL(5,4) USING "commissionRate"::DECIMAL(5,4);
ALTER TABLE "Transaction" ALTER COLUMN "taxWithheld" TYPE DECIMAL(12,2) USING "taxWithheld"::DECIMAL(12,2);
ALTER TABLE "Transaction" ALTER COLUMN "gstAmount" TYPE DECIMAL(12,2) USING "gstAmount"::DECIMAL(12,2);

-- ClientWallet
ALTER TABLE "ClientWallet" ALTER COLUMN "balance" TYPE DECIMAL(12,2) USING "balance"::DECIMAL(12,2);

-- WalletTransaction
ALTER TABLE "WalletTransaction" ALTER COLUMN "amount" TYPE DECIMAL(12,2) USING "amount"::DECIMAL(12,2);

-- Subscription
ALTER TABLE "Subscription" ALTER COLUMN "monthlyAmount" TYPE DECIMAL(10,2) USING "monthlyAmount"::DECIMAL(10,2);

-- Payout
ALTER TABLE "Payout" ALTER COLUMN "grossAmount" TYPE DECIMAL(12,2) USING "grossAmount"::DECIMAL(12,2);
ALTER TABLE "Payout" ALTER COLUMN "taxWithheld" TYPE DECIMAL(12,2) USING "taxWithheld"::DECIMAL(12,2);
ALTER TABLE "Payout" ALTER COLUMN "gstAmount" TYPE DECIMAL(12,2) USING "gstAmount"::DECIMAL(12,2);
ALTER TABLE "Payout" ALTER COLUMN "netAmount" TYPE DECIMAL(12,2) USING "netAmount"::DECIMAL(12,2);

-- PlatformLedger
ALTER TABLE "PlatformLedger" ALTER COLUMN "totalCollected" TYPE DECIMAL(12,2) USING "totalCollected"::DECIMAL(12,2);
ALTER TABLE "PlatformLedger" ALTER COLUMN "totalReserved" TYPE DECIMAL(12,2) USING "totalReserved"::DECIMAL(12,2);
ALTER TABLE "PlatformLedger" ALTER COLUMN "totalPaidOut" TYPE DECIMAL(12,2) USING "totalPaidOut"::DECIMAL(12,2);
ALTER TABLE "PlatformLedger" ALTER COLUMN "totalRefunded" TYPE DECIMAL(12,2) USING "totalRefunded"::DECIMAL(12,2);
ALTER TABLE "PlatformLedger" ALTER COLUMN "totalTaxWithheld" TYPE DECIMAL(12,2) USING "totalTaxWithheld"::DECIMAL(12,2);

-- LedgerEntry
ALTER TABLE "LedgerEntry" ALTER COLUMN "amount" TYPE DECIMAL(12,2) USING "amount"::DECIMAL(12,2);

-- PlatformSettings
ALTER TABLE "PlatformSettings" ALTER COLUMN "basicCommissionRate" TYPE DECIMAL(5,2) USING "basicCommissionRate"::DECIMAL(5,2);
ALTER TABLE "PlatformSettings" ALTER COLUMN "proCommissionRate" TYPE DECIMAL(5,2) USING "proCommissionRate"::DECIMAL(5,2);
ALTER TABLE "PlatformSettings" ALTER COLUMN "studioCommissionRate" TYPE DECIMAL(5,2) USING "studioCommissionRate"::DECIMAL(5,2);
ALTER TABLE "PlatformSettings" ALTER COLUMN "businessCommissionRate" TYPE DECIMAL(5,2) USING "businessCommissionRate"::DECIMAL(5,2);
ALTER TABLE "PlatformSettings" ALTER COLUMN "basicNewStudentBonus" TYPE DECIMAL(10,2) USING "basicNewStudentBonus"::DECIMAL(10,2);
ALTER TABLE "PlatformSettings" ALTER COLUMN "proNewStudentBonus" TYPE DECIMAL(10,2) USING "proNewStudentBonus"::DECIMAL(10,2);
ALTER TABLE "PlatformSettings" ALTER COLUMN "businessNewStudentBonus" TYPE DECIMAL(10,2) USING "businessNewStudentBonus"::DECIMAL(10,2);
ALTER TABLE "PlatformSettings" ALTER COLUMN "platformFeePercentage" TYPE DECIMAL(5,2) USING "platformFeePercentage"::DECIMAL(5,2);
ALTER TABLE "PlatformSettings" ALTER COLUMN "package6Discount" TYPE DECIMAL(5,2) USING "package6Discount"::DECIMAL(5,2);
ALTER TABLE "PlatformSettings" ALTER COLUMN "package10Discount" TYPE DECIMAL(5,2) USING "package10Discount"::DECIMAL(5,2);
ALTER TABLE "PlatformSettings" ALTER COLUMN "package15Discount" TYPE DECIMAL(5,2) USING "package15Discount"::DECIMAL(5,2);
ALTER TABLE "PlatformSettings" ALTER COLUMN "cancellationFee" TYPE DECIMAL(10,2) USING "cancellationFee"::DECIMAL(10,2);
ALTER TABLE "PlatformSettings" ALTER COLUMN "lateCancellationWindowHours" TYPE DECIMAL(6,2) USING "lateCancellationWindowHours"::DECIMAL(6,2);
ALTER TABLE "PlatformSettings" ALTER COLUMN "noShowPenaltyAmount" TYPE DECIMAL(10,2) USING "noShowPenaltyAmount"::DECIMAL(10,2);
ALTER TABLE "PlatformSettings" ALTER COLUMN "walletTopUpMin" TYPE DECIMAL(10,2) USING "walletTopUpMin"::DECIMAL(10,2);
ALTER TABLE "PlatformSettings" ALTER COLUMN "walletTopUpMax" TYPE DECIMAL(10,2) USING "walletTopUpMax"::DECIMAL(10,2);
ALTER TABLE "PlatformSettings" ALTER COLUMN "gstRate" TYPE DECIMAL(5,2) USING "gstRate"::DECIMAL(5,2);
ALTER TABLE "PlatformSettings" ALTER COLUMN "withholdingTaxRate" TYPE DECIMAL(5,2) USING "withholdingTaxRate"::DECIMAL(5,2);
ALTER TABLE "PlatformSettings" ALTER COLUMN "peakSurchargePercent" TYPE DECIMAL(5,2) USING "peakSurchargePercent"::DECIMAL(5,2);
ALTER TABLE "PlatformSettings" ALTER COLUMN "maxAdminCreditAmount" TYPE DECIMAL(12,2) USING "maxAdminCreditAmount"::DECIMAL(12,2);
ALTER TABLE "PlatformSettings" ALTER COLUMN "maxAdminDeductAmount" TYPE DECIMAL(12,2) USING "maxAdminDeductAmount"::DECIMAL(12,2);

-- PDATestConfig
ALTER TABLE "PDATestConfig" ALTER COLUMN "price" TYPE DECIMAL(12,2) USING "price"::DECIMAL(12,2);
ALTER TABLE "PDATestConfig" ALTER COLUMN "discountPercent" TYPE DECIMAL(5,2) USING "discountPercent"::DECIMAL(5,2);

-- PDATestBooking
ALTER TABLE "PDATestBooking" ALTER COLUMN "price" TYPE DECIMAL(12,2) USING "price"::DECIMAL(12,2);
ALTER TABLE "PDATestBooking" ALTER COLUMN "discountPercent" TYPE DECIMAL(5,2) USING "discountPercent"::DECIMAL(5,2);

-- StripeDispute
ALTER TABLE "StripeDispute" ALTER COLUMN "amount" TYPE DECIMAL(12,2) USING "amount"::DECIMAL(12,2);

-- Task
ALTER TABLE "Task" ALTER COLUMN "financialAmount" TYPE DECIMAL(12,2) USING "financialAmount"::DECIMAL(12,2);

-- StaffMember
ALTER TABLE "StaffMember" ALTER COLUMN "maxRefundAmount" TYPE DECIMAL(10,2) USING "maxRefundAmount"::DECIMAL(10,2);

-- FinancialLedger
ALTER TABLE "FinancialLedger" ALTER COLUMN "amount" TYPE DECIMAL(12,2) USING "amount"::DECIMAL(12,2);

-- Quote
ALTER TABLE "Quote" ALTER COLUMN "amount" TYPE DECIMAL(12,2) USING "amount"::DECIMAL(12,2);
ALTER TABLE "Quote" ALTER COLUMN "depositPercent" TYPE DECIMAL(5,2) USING "depositPercent"::DECIMAL(5,2);
ALTER TABLE "Quote" ALTER COLUMN "depositAmount" TYPE DECIMAL(12,2) USING "depositAmount"::DECIMAL(12,2);

-- BusinessSettings
ALTER TABLE "BusinessSettings" ALTER COLUMN "platformFeePercent" TYPE DECIMAL(5,2) USING "platformFeePercent"::DECIMAL(5,2);
ALTER TABLE "BusinessSettings" ALTER COLUMN "commissionRate" TYPE DECIMAL(5,2) USING "commissionRate"::DECIMAL(5,2);
ALTER TABLE "BusinessSettings" ALTER COLUMN "cancellationRefundPercent" TYPE DECIMAL(5,2) USING "cancellationRefundPercent"::DECIMAL(5,2);
ALTER TABLE "BusinessSettings" ALTER COLUMN "package6Discount" TYPE DECIMAL(5,2) USING "package6Discount"::DECIMAL(5,2);
ALTER TABLE "BusinessSettings" ALTER COLUMN "package10Discount" TYPE DECIMAL(5,2) USING "package10Discount"::DECIMAL(5,2);
ALTER TABLE "BusinessSettings" ALTER COLUMN "package15Discount" TYPE DECIMAL(5,2) USING "package15Discount"::DECIMAL(5,2);
ALTER TABLE "BusinessSettings" ALTER COLUMN "gstRate" TYPE DECIMAL(5,2) USING "gstRate"::DECIMAL(5,2);

-- BusinessService
ALTER TABLE "BusinessService" ALTER COLUMN "price" TYPE DECIMAL(12,2) USING "price"::DECIMAL(12,2);
ALTER TABLE "BusinessService" ALTER COLUMN "depositPercent" TYPE DECIMAL(5,2) USING "depositPercent"::DECIMAL(5,2);
ALTER TABLE "BusinessService" ALTER COLUMN "refundPercent" TYPE DECIMAL(5,2) USING "refundPercent"::DECIMAL(5,2);

-- DrivingProviderProfile
ALTER TABLE "DrivingProviderProfile" ALTER COLUMN "testPackagePrice" TYPE DECIMAL(12,2) USING "testPackagePrice"::DECIMAL(12,2);
ALTER TABLE "DrivingProviderProfile" ALTER COLUMN "testPackageDefaultPrice" TYPE DECIMAL(12,2) USING "testPackageDefaultPrice"::DECIMAL(12,2);
