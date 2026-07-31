import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

/**
 * Test config.
 *
 * Chiefly here for the `@/` alias. tsconfig.json maps it to the project root,
 * but vitest does not read tsconfig paths, so any module imported through it
 * failed to resolve under test — which quietly meant a file could not be tested
 * at all once it imported anything by alias.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['**/__tests__/**/*.test.ts', '**/*.test.ts'],
    exclude: ['node_modules/**', '.next/**'],
  },
})
