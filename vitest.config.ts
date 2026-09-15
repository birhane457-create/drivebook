import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    hookTimeout: 30000,   // allow 30s for beforeAll/afterAll against cloud DB
    testTimeout: 60000,   // allow 60s per test (cloud DB + concurrent ops need headroom)
    setupFiles: ['./lib/services/receipt/__tests__/setup.ts'],
    include: ['**/__tests__/**/*.test.ts'],
    exclude: ['node_modules', 'dist', '.next'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        '**/__tests__/**',
        '**/*.config.ts',
      ]
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
})
