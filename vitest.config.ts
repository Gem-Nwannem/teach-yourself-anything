import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: { include: ['packages/*/test/**/*.test.ts', 'packages/*/test/**/*.test.tsx'] },
  resolve: {
    alias: {
      '@tya/schema': new URL('./packages/schema/src/index.ts', import.meta.url).pathname,
      '@tya/renderers': new URL('./packages/renderers/src/index.ts', import.meta.url).pathname,
    },
  },
})
