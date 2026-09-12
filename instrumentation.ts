/**
 * Next.js Instrumentation Hook
 * Runs once on server startup (both Node.js and Edge runtimes).
 *
 * Used to validate required environment variables before the app
 * begins accepting requests. A missing or placeholder value causes
 * a hard startup failure with a clear message rather than a silent
 * runtime error deep inside a request handler.
 *
 * Docs: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  // Only validate on the Node.js runtime (server-side startup).
  // Edge runtime does not have access to all env vars at this hook point.
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    validateEnv();
  }
}

// ── Required variable definitions ─────────────────────────────────────────────
type EnvRule =
  | { key: string; required: true; format?: RegExp; formatHint?: string }
  | { key: string; required: false };

const ENV_RULES: EnvRule[] = [
  // Auth
  {
    key: 'NEXTAUTH_URL',
    required: true,
    format: /^https?:\/\/.+/,
    formatHint: 'must start with http:// or https://',
  },
  {
    key: 'NEXTAUTH_SECRET',
    required: true,
    format: /^.{32,}/,
    formatHint: 'must be at least 32 characters',
  },

  // Database
  { key: 'DATABASE_URL', required: true },

  // Stripe — payment flow breaks entirely without these
  {
    key: 'STRIPE_SECRET_KEY',
    required: true,
    format: /^sk_(live|test)_/,
    formatHint: 'must start with sk_live_ or sk_test_',
  },
  {
    key: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
    required: true,
    format: /^pk_(live|test)_/,
    formatHint: 'must start with pk_live_ or pk_test_',
  },
  {
    key: 'STRIPE_WEBHOOK_SECRET',
    required: true,
    format: /^whsec_/,
    formatHint: 'must start with whsec_',
  },
];

function validateEnv(): void {
  const errors: string[] = [];

  for (const rule of ENV_RULES) {
    const value = process.env[rule.key];

    if (!rule.required) continue;

    if (!value || value.trim() === '') {
      errors.push(`  ✗ ${rule.key} — missing or empty`);
      continue;
    }

    if (rule.format && !rule.format.test(value)) {
      errors.push(`  ✗ ${rule.key} — ${rule.formatHint ?? 'invalid format'} (got: ${value.slice(0, 20)}…)`);
    }
  }

  if (errors.length > 0) {
    // Hard crash on startup — better than a silent runtime failure mid-request.
    console.error('\n🚨 STARTUP FAILURE: Required environment variables are missing or invalid:\n');
    errors.forEach((e) => console.error(e));
    console.error(
      '\nFix the values in your .env file (or Vercel / hosting provider environment settings) and restart.\n',
    );
    // In production throw so the process exits non-zero and the deployment health check fails.
    // In development just warn so hot-reload still works.
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`Startup aborted: ${errors.length} required environment variable(s) are invalid.`);
    }
  } else {
    console.log('✅ Environment validation passed');
  }
}
