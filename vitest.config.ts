import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Use forks pool: spawns real child processes with full stdio.
    // Worker threads in Node 20 have incomplete stdio which crashes modules
    // that touch process.stdout at load time.
    pool: 'forks',
    hookTimeout: 30000,
    testTimeout: 60000,
    setupFiles: [
      './lib/services/receipt/__tests__/setup.ts',
      './__tests__/setup/email-mock.ts',
    ],
    include: [
      'lib/**/__tests__/**/*.test.ts',
      '__tests__/**/*.test.ts',
    ],
    exclude: ['node_modules', 'dist', '.next'],
    env: {
      // Guard: refuse to run tests against a production database.
      // TEST_DATABASE_URL must point to localhost or a known test project.
      // Production Supabase hosts are explicitly blocked.
      DATABASE_URL: (() => {
        const url = process.env.TEST_DATABASE_URL || 'postgresql://postgres:testpass@localhost:5433/drivebook_test'
        const blocked = ['jflrqxigfiiqednfacuf', 'zzntmozvppyzeaqautpi', 'pooler.supabase.com']
        if (blocked.some(h => url.includes(h))) {
          throw new Error(
            `TEST_DATABASE_URL points at a production database.\n` +
            `Tests must not run against production. Use localhost:5433/drivebook_test\n` +
            `or a dedicated test Supabase project.\n` +
            `Blocked hosts: ${blocked.join(', ')}`
          )
        }
        return url
      })(),
    },
    // Explicitly transform test files so Next.js instrumentation hooks
    // cannot intercept them and strip the Vitest test context.
    testTransformMode: {
      web: [],
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', '**/__tests__/**', '**/*.config.ts'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      // Lightweight next/server stub — the real module needs the Next.js runtime.
      'next/server': path.resolve(__dirname, './__tests__/stubs/next-server.ts'),
    },
  },
})
