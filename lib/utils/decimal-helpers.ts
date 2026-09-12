/**
 * Decimal Helper Utilities
 * 
 * Provides safe, convenient wrappers for Prisma Decimal arithmetic operations.
 * Eliminates floating-point precision errors in financial calculations.
 * 
 * Usage:
 *   import { addAmounts, multiplyAmount, formatCurrency } from '@/lib/utils/decimal-helpers';
 *   
 *   const total = addAmounts(booking.price, booking.platformFee);
 *   const fee = multiplyAmount(booking.price, 0.15);
 *   const display = formatCurrency(total); // "$123.45"
 */

import { Decimal } from 'decimal.js';

// ═══════════════════════════════════════════════════════════════════════════
// TYPE GUARDS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Type guard to check if a value is a Decimal instance
 */
export function isDecimal(value: unknown): value is Decimal {
  return value instanceof Decimal;
}

/**
 * Type for values that can be converted to Decimal
 */
export type DecimalInput = Decimal | number | string;

// ═══════════════════════════════════════════════════════════════════════════
// CONVERSION UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Safely convert any valid input to a Decimal instance
 * Returns Decimal(0) for null/undefined
 */
export function toDecimal(value: DecimalInput | null | undefined): Decimal {
  if (value === null || value === undefined) return new Decimal(0);
  if (isDecimal(value)) return value;
  return new Decimal(value);
}

/**
 * Convert Decimal to number (for display, calculations with non-Decimal values)
 * Warning: May lose precision for very large numbers
 */
export function toNumber(value: DecimalInput | null | undefined): number {
  return toDecimal(value).toNumber();
}

/**
 * Convert Decimal to string with fixed decimal places
 * Default: 2 decimal places for currency
 */
export function toFixed(value: DecimalInput | null | undefined, decimals: number = 2): string {
  return toDecimal(value).toFixed(decimals);
}

// ═══════════════════════════════════════════════════════════════════════════
// ARITHMETIC OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Add two or more amounts
 * Usage: addAmounts(price, fee, tax)
 */
export function addAmounts(...values: (DecimalInput | null | undefined)[]): Decimal {
  return values.reduce<Decimal>(
    (sum, value) => sum.plus(toDecimal(value)),
    new Decimal(0)
  );
}

/**
 * Subtract second amount from first
 * Usage: subtractAmounts(total, discount)
 */
export function subtractAmounts(
  a: DecimalInput | null | undefined,
  b: DecimalInput | null | undefined
): Decimal {
  return toDecimal(a).minus(toDecimal(b));
}

/**
 * Multiply amount by a factor (number or Decimal)
 * Usage: multiplyAmount(price, quantity) or multiplyAmount(price, 1.1) for 10% increase
 */
export function multiplyAmount(
  amount: DecimalInput | null | undefined,
  factor: DecimalInput | null | undefined
): Decimal {
  return toDecimal(amount).times(toDecimal(factor));
}

/**
 * Divide amount by divisor
 * Usage: divideAmount(total, count) for averages
 */
export function divideAmount(
  amount: DecimalInput | null | undefined,
  divisor: DecimalInput | null | undefined
): Decimal {
  const div = toDecimal(divisor);
  if (div.isZero()) {
    throw new Error('Division by zero');
  }
  return toDecimal(amount).dividedBy(div);
}

// ═══════════════════════════════════════════════════════════════════════════
// PERCENTAGE CALCULATIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calculate percentage of an amount
 * Usage: calculatePercentage(1000, 15) // 15% of 1000 = 150
 */
export function calculatePercentage(
  amount: DecimalInput | null | undefined,
  percent: DecimalInput | null | undefined
): Decimal {
  return toDecimal(amount).times(toDecimal(percent)).dividedBy(100);
}

/**
 * Apply percentage increase to amount
 * Usage: applyPercentageIncrease(100, 10) // 100 + 10% = 110
 */
export function applyPercentageIncrease(
  amount: DecimalInput | null | undefined,
  percent: DecimalInput | null | undefined
): Decimal {
  const base = toDecimal(amount);
  const increase = calculatePercentage(base, percent);
  return base.plus(increase);
}

/**
 * Apply percentage decrease to amount
 * Usage: applyPercentageDecrease(100, 10) // 100 - 10% = 90
 */
export function applyPercentageDecrease(
  amount: DecimalInput | null | undefined,
  percent: DecimalInput | null | undefined
): Decimal {
  const base = toDecimal(amount);
  const decrease = calculatePercentage(base, percent);
  return base.minus(decrease);
}

/**
 * Apply discount to amount
 * Alias for applyPercentageDecrease for clarity in business logic
 */
export function applyDiscount(
  amount: DecimalInput | null | undefined,
  discountPercent: DecimalInput | null | undefined
): Decimal {
  return applyPercentageDecrease(amount, discountPercent);
}

// ═══════════════════════════════════════════════════════════════════════════
// DRIVEBOOK-SPECIFIC BUSINESS LOGIC
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calculate platform commission from booking amount
 * Usage: calculateCommission(bookingAmount, 15) // 15% commission
 */
export function calculateCommission(
  bookingAmount: DecimalInput | null | undefined,
  commissionRate: DecimalInput | null | undefined
): Decimal {
  return calculatePercentage(bookingAmount, commissionRate);
}

/**
 * Calculate provider payout after commission
 * Usage: calculateProviderPayout(bookingAmount, 15) // bookingAmount - 15% commission
 */
export function calculateProviderPayout(
  bookingAmount: DecimalInput | null | undefined,
  commissionRate: DecimalInput | null | undefined
): Decimal {
  const amount = toDecimal(bookingAmount);
  const commission = calculateCommission(amount, commissionRate);
  return amount.minus(commission);
}

/**
 * Calculate GST amount (10% in Australia)
 * Usage: calculateGST(100) // 10
 */
export function calculateGST(
  amount: DecimalInput | null | undefined,
  gstRate: DecimalInput = 10
): Decimal {
  return calculatePercentage(amount, gstRate);
}

/**
 * Calculate amount including GST
 * Usage: addGST(100) // 110
 */
export function addGST(
  amount: DecimalInput | null | undefined,
  gstRate: DecimalInput = 10
): Decimal {
  return applyPercentageIncrease(amount, gstRate);
}

/**
 * Calculate amount excluding GST (reverse calculation)
 * Usage: removeGST(110) // 100
 */
export function removeGST(
  amountIncludingGST: DecimalInput | null | undefined,
  gstRate: DecimalInput = 10
): Decimal {
  const rateDecimal = toDecimal(gstRate);
  const divisor = new Decimal(100).plus(rateDecimal).dividedBy(100);
  return toDecimal(amountIncludingGST).dividedBy(divisor);
}

/**
 * Calculate package discount based on hours
 * Usage: calculatePackageDiscount(1000, 10) // 10% discount
 */
export function calculatePackageDiscount(
  basePrice: DecimalInput | null | undefined,
  discountPercent: DecimalInput | null | undefined
): Decimal {
  return calculatePercentage(basePrice, discountPercent);
}

/**
 * Calculate package final price after discount
 * Usage: calculatePackagePrice(1000, 6, 5) // 6 hours at 1000, 5% discount
 */
export function calculatePackagePrice(
  hourlyRate: DecimalInput | null | undefined,
  hours: DecimalInput | null | undefined,
  discountPercent: DecimalInput | null | undefined = 0
): Decimal {
  const basePrice = multiplyAmount(hourlyRate, hours);
  return applyDiscount(basePrice, discountPercent);
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPARISON UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Check if amount is zero
 */
export function isZero(value: DecimalInput | null | undefined): boolean {
  return toDecimal(value).isZero();
}

/**
 * Check if amount is positive
 */
export function isPositive(value: DecimalInput | null | undefined): boolean {
  return toDecimal(value).greaterThan(0);
}

/**
 * Check if amount is negative
 */
export function isNegative(value: DecimalInput | null | undefined): boolean {
  return toDecimal(value).lessThan(0);
}

/**
 * Compare two amounts for equality
 */
export function isEqual(
  a: DecimalInput | null | undefined,
  b: DecimalInput | null | undefined
): boolean {
  return toDecimal(a).equals(toDecimal(b));
}

/**
 * Check if first amount is greater than second
 */
export function isGreaterThan(
  a: DecimalInput | null | undefined,
  b: DecimalInput | null | undefined
): boolean {
  return toDecimal(a).greaterThan(toDecimal(b));
}

/**
 * Check if first amount is less than second
 */
export function isLessThan(
  a: DecimalInput | null | undefined,
  b: DecimalInput | null | undefined
): boolean {
  return toDecimal(a).lessThan(toDecimal(b));
}

/**
 * Check if first amount is greater than or equal to second
 */
export function isGreaterThanOrEqual(
  a: DecimalInput | null | undefined,
  b: DecimalInput | null | undefined
): boolean {
  return toDecimal(a).greaterThanOrEqualTo(toDecimal(b));
}

/**
 * Get the minimum of two or more amounts
 */
export function minAmount(...values: (DecimalInput | null | undefined)[]): Decimal {
  if (values.length === 0) return new Decimal(0);
  return values.reduce<Decimal>((min, value) => {
    const decimal = toDecimal(value);
    return decimal.lessThan(min) ? decimal : min;
  }, toDecimal(values[0]));
}

/**
 * Get the maximum of two or more amounts
 */
export function maxAmount(...values: (DecimalInput | null | undefined)[]): Decimal {
  if (values.length === 0) return new Decimal(0);
  return values.reduce<Decimal>((max, value) => {
    const decimal = toDecimal(value);
    return decimal.greaterThan(max) ? decimal : max;
  }, toDecimal(values[0]));
}

// ═══════════════════════════════════════════════════════════════════════════
// FORMATTING UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Format amount as currency string with symbol
 * Usage: formatCurrency(123.45) // "$123.45"
 */
export function formatCurrency(
  amount: DecimalInput | null | undefined,
  currency: string = 'AUD',
  locale: string = 'en-AU'
): string {
  const num = toNumber(amount);
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency,
  }).format(num);
}

/**
 * Format amount as currency without symbol
 * Usage: formatAmount(123.456) // "123.46"
 */
export function formatAmount(
  amount: DecimalInput | null | undefined,
  decimals: number = 2
): string {
  return toFixed(amount, decimals);
}

/**
 * Format percentage with symbol
 * Usage: formatPercentage(15.5) // "15.50%"
 */
export function formatPercentage(
  percent: DecimalInput | null | undefined,
  decimals: number = 2
): string {
  return `${toFixed(percent, decimals)}%`;
}

// ═══════════════════════════════════════════════════════════════════════════
// AGGREGATION UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Sum an array of amounts
 * Usage: sumAmounts([10, 20, 30]) // 60
 */
export function sumAmounts(amounts: (DecimalInput | null | undefined)[]): Decimal {
  return amounts.reduce<Decimal>(
    (sum, amount) => sum.plus(toDecimal(amount)),
    new Decimal(0)
  );
}

/**
 * Calculate average of amounts
 * Usage: averageAmounts([10, 20, 30]) // 20
 */
export function averageAmounts(amounts: (DecimalInput | null | undefined)[]): Decimal {
  if (amounts.length === 0) return new Decimal(0);
  const sum = sumAmounts(amounts);
  return sum.dividedBy(amounts.length);
}

/**
 * Round to specified decimal places
 * Usage: roundAmount(123.456, 2) // 123.46
 */
export function roundAmount(
  amount: DecimalInput | null | undefined,
  decimals: number = 2
): Decimal {
  return toDecimal(amount).toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP);
}

/**
 * Round up to specified decimal places (ceiling)
 * Usage: ceilAmount(123.451, 2) // 123.46
 */
export function ceilAmount(
  amount: DecimalInput | null | undefined,
  decimals: number = 2
): Decimal {
  return toDecimal(amount).toDecimalPlaces(decimals, Decimal.ROUND_CEIL);
}

/**
 * Round down to specified decimal places (floor)
 * Usage: floorAmount(123.459, 2) // 123.45
 */
export function floorAmount(
  amount: DecimalInput | null | undefined,
  decimals: number = 2
): Decimal {
  return toDecimal(amount).toDecimalPlaces(decimals, Decimal.ROUND_FLOOR);
}

// ═══════════════════════════════════════════════════════════════════════════
// VALIDATION UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Ensure amount is non-negative (return 0 if negative)
 * Usage: ensureNonNegative(-10) // 0
 */
export function ensureNonNegative(amount: DecimalInput | null | undefined): Decimal {
  const decimal = toDecimal(amount);
  return decimal.lessThan(0) ? new Decimal(0) : decimal;
}

/**
 * Clamp amount between min and max
 * Usage: clampAmount(150, 0, 100) // 100
 */
export function clampAmount(
  amount: DecimalInput | null | undefined,
  min: DecimalInput,
  max: DecimalInput
): Decimal {
  const decimal = toDecimal(amount);
  const minDecimal = toDecimal(min);
  const maxDecimal = toDecimal(max);
  
  if (decimal.lessThan(minDecimal)) return minDecimal;
  if (decimal.greaterThan(maxDecimal)) return maxDecimal;
  return decimal;
}

// ═══════════════════════════════════════════════════════════════════════════
// PRISMA DATABASE HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Prepare Decimal for Prisma create/update operations
 * Ensures value is a Decimal instance for database operations
 */
export function toPrismaDecimal(value: DecimalInput | null | undefined): Decimal | null {
  if (value === null || value === undefined) return null;
  return toDecimal(value);
}

/**
 * Convert database Decimal to display number safely
 * Returns 0 if value is null/undefined
 */
export function fromPrismaDecimal(value: Decimal | null | undefined): number {
  return toNumber(value);
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORT ALL FOR CONVENIENCE
// ═══════════════════════════════════════════════════════════════════════════

export default {
  // Conversion
  toDecimal,
  toNumber,
  toFixed,
  
  // Arithmetic
  addAmounts,
  subtractAmounts,
  multiplyAmount,
  divideAmount,
  
  // Percentage
  calculatePercentage,
  applyPercentageIncrease,
  applyPercentageDecrease,
  applyDiscount,
  
  // Business Logic
  calculateCommission,
  calculateProviderPayout,
  calculateGST,
  addGST,
  removeGST,
  calculatePackageDiscount,
  calculatePackagePrice,
  
  // Comparison
  isZero,
  isPositive,
  isNegative,
  isEqual,
  isGreaterThan,
  isLessThan,
  minAmount,
  maxAmount,
  
  // Formatting
  formatCurrency,
  formatAmount,
  formatPercentage,
  
  // Aggregation
  sumAmounts,
  averageAmounts,
  roundAmount,
  ceilAmount,
  floorAmount,
  
  // Validation
  ensureNonNegative,
  clampAmount,
  
  // Prisma
  toPrismaDecimal,
  fromPrismaDecimal,
};