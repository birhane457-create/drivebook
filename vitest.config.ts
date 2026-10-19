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
      DATABASE_URL: process.env.TEST_DATABASE_URL || 'postgresql://postgres:testpass@localhost:5433/drivebook_test',
    },
    // Explicitly transform test files so Next.js instrumentation hooks
    // cannot intercept them and strip the Vitest test context.
    transformMode: {
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
