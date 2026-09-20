/**
 * Minimal vitest config for MM financial integrity tests.
 * Uses no setupFiles to avoid the shared setup.ts environment issue.
 */
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 30000,
    include: ['lib/services/__tests__/mm-financial-integrity.test.ts'],
    exclude: ['node_modules'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
})
