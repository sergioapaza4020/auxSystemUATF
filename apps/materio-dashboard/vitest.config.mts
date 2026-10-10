import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  oxc: { jsx: { runtime: 'automatic' } },
});
