import { fileURLToPath } from 'node:url';

export default {
  root: fileURLToPath(new URL('.', import.meta.url)),
  resolve: {
    alias: [
      { find: '@/api/attendances.service', replacement: fileURLToPath(new URL('./services.ts', import.meta.url)) },
      { find: '@/hooks/useSnackbar', replacement: fileURLToPath(new URL('./snackbar.ts', import.meta.url)) },
      { find: '@', replacement: fileURLToPath(new URL('../../src', import.meta.url)) },
    ],
  },
  oxc: { jsx: { runtime: 'automatic' } },
  server: { host: '127.0.0.1', port: 4317, strictPort: true },
};
