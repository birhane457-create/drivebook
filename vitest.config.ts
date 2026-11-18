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
      // Guard: refuse to run tests against production databases.
      // TEST_DATABASE_URL must point to localhost or a designated test project.
      // Production Supabase project (Sydney, jflrqxigfiiqednfacuf) is explicitly blocked.
      // Designated test project (Japan, zzntmozvppyzeaqautpi) is allowed — it is an
      // unused project with old schema, no production users.
      DATABASE_URL: (() => {
        const url = process.env.TEST_DATABASE_URL || 'postgresql://postgres:testpass@localhost:5433/drivebook_test'
        const blocked = ['jflrqxigfiiqednfacuf']  // production only — Japan test project allowed
        if (blocked.some(h => url.includes(h))) {
          throw new Error(
            `TEST_DATABASE_URL points at the production database (Sydney).\n` +
            `Tests must not run against production. Use localhost:5433/drivebook_test\n` +
            `or the designated test project (Japan: zzntmozvppyzeaqautpi).\n` +
            `Blocked: ${blocked.join(', ')}`
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
