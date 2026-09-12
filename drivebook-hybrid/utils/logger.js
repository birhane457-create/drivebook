'use strict';

/**
 * logger.js
 *
 * Lightweight structured JSON logger for the drivebook-hybrid service.
 *
 * Outputs to stdout/stderr in all environments (Railway, Docker, Vercel all
 * capture stdout natively). Filesystem log files are not used  they require
 * disk access, don't survive container restarts, and aren't visible in cloud
 * log aggregators.
 *
 * Log level is controlled by the LOG_LEVEL env var (default: info).
 * Levels in ascending severity: debug < info < warn < error
 * Setting LOG_LEVEL=warn suppresses info and debug output.
 *
 * PII masking is applied before any field reaches the output stream.
 */

//  Log level configuration 
const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };

const configuredLevel = (process.env.LOG_LEVEL || 'info').toLowerCase();
const MIN_LEVEL = LEVELS[configuredLevel] ?? LEVELS.info;

function shouldLog(level) {
  return (LEVELS[level] ?? 0) >= MIN_LEVEL;
}

//  PII masking 
// Any key in this set will have its value masked before logging.
// Add fields here as new PII surfaces  never remove entries.
const PII_KEYS = new Set([
  'phone',
  'to',
  'from',
  'callerPhone',
  'accountHolderPhone',
  'accountHolderEmail',
  'clientPhone',
  'clientEmail',
  'email',
  'verificationId',
  'verificationToken',
  'checkoutUrl',
  'recordingUrl',
]);

function maskPhone(value) {
  if (!value) return value;
  // Keep country code prefix (up to 4 chars) and last 2 digits, mask the middle
  return String(value).replace(/^(\+?\d{1,4})(\d+)(\d{2})$/, (_, prefix, middle, suffix) =>
    `${prefix}${'*'.repeat(middle.length)}${suffix}`
  );
}

/**
 * Recursively walk a meta object and mask PII field values.
 * Returns a new object  never mutates the caller's data.
 *
 * Circular reference handling: a WeakSet tracks every object visited in the
 * current traversal. If the same reference is encountered again, it is replaced
 * with the string "[Circular]" rather than recursing into it. The depth cap
 * remains as a secondary guard against pathologically deep (but non-circular)
 * object graphs.
 *
 * @param {unknown} obj
 * @param {number}  depth    secondary guard: max nesting depth (4 levels)
 * @param {WeakSet} visited  tracks visited object references (circular detection)
 * @returns {unknown}
 */
function maskMeta(obj, depth = 0, visited = new WeakSet()) {
  if (depth > 4 || obj === null || obj === undefined) return obj;

  // Primitives pass through unchanged
  if (typeof obj !== 'object') return obj;

  // Circular reference detected — replace with a safe sentinel rather than looping
  if (visited.has(obj)) return '[Circular]';
  visited.add(obj);

  // Date → ISO string (avoids [object Object] in logs)
  if (obj instanceof Date) return obj.toISOString();

  // RegExp → string representation
  if (obj instanceof RegExp) return obj.toString();

  // Error → preserve message and stack
  if (obj instanceof Error) {
    return { message: obj.message, ...(obj.stack ? { stack: obj.stack } : {}) };
  }

  if (Array.isArray(obj)) return obj.map((item) => maskMeta(item, depth + 1, visited));

  const masked = {};
  for (const [key, value] of Object.entries(obj)) {
    if (PII_KEYS.has(key)) {
      // Phone-like fields get partial masking; others get full redaction
      const isPhone = key.toLowerCase().includes('phone') || key === 'to' || key === 'from';
      masked[key] = isPhone ? maskPhone(value) : '[REDACTED]';
    } else {
      masked[key] = maskMeta(value, depth + 1, visited);
    }
  }
  return masked;
}

//  Core write 
/**
 * Write a structured JSON log entry to stdout (info/debug/warn) or stderr (error).
 * Never throws  logging must not break the calling code path.
 */
function write(level, msg, meta) {
  if (!shouldLog(level)) return;

  // Build entry without mutating caller's meta object (fix: spread into new object)
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    msg: String(msg),
  };

  if (meta !== undefined && meta !== null) {
    entry.meta = maskMeta(typeof meta === 'object' ? meta : { value: meta });
  }

  const line = JSON.stringify(entry);

  try {
    if (level === 'error') {
      process.stderr.write(line + '\n');
    } else {
      process.stdout.write(line + '\n');
    }
  } catch {
    // Last-resort fallback if stdout/stderr write fails (e.g. closed pipe)
  }
}

//  Public API 

function logInfo(msg, meta) {
  write('info', msg, meta);
}

function logWarning(msg, meta) {
  write('warn', msg, meta);
}

/**
 * Log an error with full stack trace.
 * Accepts either an Error object (stack captured) or a plain message string.
 *
 * @param {Error|string} err
 * @param {object} [meta]   additional context fields
 */
function logError(err, meta) {
  const isError = err instanceof Error;
  const message = isError ? err.message : String(err);
  const stack   = isError ? err.stack   : undefined;

  write('error', message, {
    ...(typeof meta === 'object' && meta !== null ? meta : {}),
    ...(stack ? { stack } : {}),
  });
}

/**
 * Debug-level logging  suppressed unless LOG_LEVEL=debug.
 * Use for high-frequency internal state that is only useful during development.
 */
function logDebug(msg, meta) {
  write('debug', msg, meta);
}

module.exports = { logInfo, logError, logWarning, logDebug };