/**
 * ABN Validation Utilities
 *
 * Layer 1: Checksum validation (instant, no network)
 * Used on both client and server before any API call.
 */

/**
 * Validates ABN format and checksum per ATO algorithm.
 * Returns true only if the ABN passes the official weighted sum check.
 */
export function isValidABNFormat(abn: string): boolean {
  const cleaned = abn.replace(/[\s-]/g, '');
  if (!/^\d{11}$/.test(cleaned)) return false;

  const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
  const digits = cleaned.split('').map(Number);

  // Subtract 1 from first digit per ATO algorithm
  digits[0] = digits[0] - 1;

  const sum = digits.reduce((acc, digit, i) => acc + digit * weights[i], 0);
  return sum % 89 === 0;
}

/**
 * Formats an ABN into the standard ATO display format: XX XXX XXX XXX
 */
export function formatABN(abn: string): string {
  const cleaned = abn.replace(/\D/g, '');
  if (cleaned.length !== 11) return abn;
  return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{3})/, '$1 $2 $3 $4');
}

// ─── Name matching ────────────────────────────────────────────────────────────

/**
 * Business name suffixes and noise words that should be ignored when
 * comparing an instructor's name against the ABR entity name.
 * e.g. "John Smith Pty Ltd" should match "John Smith"
 */
const STOP_WORDS = new Set([
  'pty', 'ltd', 'ptyltd', 'the', 'and', 'of', 'a', 'an',
  'group', 'services', 'service', 'solutions', 'consulting',
  'australia', 'australian', 'trust', 'trading', 'enterprises',
  'enterprise', 'holdings', 'management', 'co', 'company',
]);

/**
 * Normalise a name string: lowercase, strip punctuation, collapse whitespace.
 */
export function normalizeName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
}

/**
 * Tokenise a name into meaningful words, filtering stop words and empty tokens.
 */
export function tokenizeName(s: string): string[] {
  return normalizeName(s)
    .split(/\s+/)
    .filter(t => t.length > 0 && !STOP_WORDS.has(t));
}

/**
 * Fuzzy name match for ABN ownership verification.
 *
 * Strategy (in order):
 * 1. Exact token-set match after stop-word removal (handles order swaps, Pty Ltd noise)
 * 2. Subset containment — one name's tokens are a subset of the other's
 *    (handles middle names, "John A Smith" vs "John Smith")
 * 3. Jaccard similarity on token sets (intersection / union)
 *
 * Returns { match: boolean; score: number } so callers can decide
 * whether to auto-approve or flag for REVIEW_REQUIRED.
 */
export function isNameMatch(
  providedName: string,
  abnEntityName: string,
): { match: boolean; score: number } {
  const a = tokenizeName(providedName);
  const b = tokenizeName(abnEntityName);

  if (!a.length || !b.length) return { match: false, score: 0 };

  const setA = new Set(a);
  const setB = new Set(b);

  // 1. Exact token-set match (after stop-word removal)
  if (setA.size === setB.size && [...setA].every(t => setB.has(t))) {
    return { match: true, score: 1.0 };
  }

  // 2. Subset containment — handles middle names / extra ABR tokens
  //    e.g. ["john", "smith"] ⊆ ["john", "a", "smith"]
  const aInB = [...setA].every(t => setB.has(t));
  const bInA = [...setB].every(t => setA.has(t));
  if (aInB || bInA) {
    return { match: true, score: 0.9 };
  }

  // 3. Jaccard similarity: intersection / union
  const intersection = [...setA].filter(t => setB.has(t)).length;
  const union = new Set([...setA, ...setB]).size;
  const score = union === 0 ? 0 : parseFloat((intersection / union).toFixed(4));

  return { match: score >= NAME_MATCH_AUTO_APPROVE_THRESHOLD, score };
}

/** Minimum similarity score to auto-approve without admin review */
export const NAME_MATCH_AUTO_APPROVE_THRESHOLD = 0.8;
/** Minimum score to flag as REVIEW_REQUIRED instead of outright rejection */
export const NAME_MATCH_REVIEW_THRESHOLD = 0.5;

// ─── BSB / Bank account validation ───────────────────────────────────────────

/**
 * BSB Validation
 *
 * Australia has no official BSB verification API.
 * We validate format and map to a known bank name for UX feedback.
 * This prevents typos but does NOT verify account ownership.
 */

/** Validates BSB format: 6 digits, optionally hyphenated (XXX-XXX) */
export function isValidBSB(bsb: string): boolean {
  return /^\d{3}-?\d{3}$/.test(bsb.trim());
}

/** Validates Australian bank account number: 6–10 digits */
export function isValidBankAccount(account: string): boolean {
  return /^\d{6,10}$/.test(account.trim());
}

/**
 * Returns the bank name for a BSB prefix, or null if unknown.
 * Covers major Australian banks by BSB prefix ranges.
 */
export function getBankNameFromBSB(bsb: string): string | null {
  const prefix = bsb.replace('-', '').slice(0, 3);
  const n = parseInt(prefix, 10);

  if (n >= 60 && n <= 69) return 'Commonwealth Bank';
  if (n >= 30 && n <= 39) return 'Westpac';
  if (n >= 10 && n <= 19) return 'ANZ';
  if (n >= 80 && n <= 89) return 'NAB';
  if (prefix === '633') return 'Bendigo Bank';
  if (prefix === '124') return 'Bank of Queensland';
  if (prefix === '484') return 'Suncorp';
  if (prefix === '923') return 'ING';
  if (prefix === '182') return 'Macquarie Bank';
  if (prefix === '112') return 'St.George Bank';
  if (prefix === '193') return 'Bank of Melbourne';
  if (prefix === '105') return 'BankSA';
  if (prefix === '342') return 'HSBC';
  if (prefix === '242') return 'Citibank';
  if (prefix === '301') return 'Up Bank';

  return null;
}
