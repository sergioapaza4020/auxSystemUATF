import { fileURLToPath } from 'node:url';
export default {
  root: fileURLToPath(new URL('.', import.meta.url)),
  define: { 'process.env.NEXT_PUBLIC_ATTENDANCE_QR_ORIGIN': JSON.stringify('https://qr.test.invalid') },
  resolve: {
    alias: [
      ...[
        '@/api/attendances.service',
        '@/hooks/useAuth',
        '@/hooks/useSnackbar',
        '@/utils/authCookies',
        'next/navigation',
      ].map((find) => ({ find, replacement: fileURLToPath(new URL('./fixtures.ts', import.meta.url)) })),
      { find: '@', replacement: fileURLToPath(new URL('../../src', import.meta.url)) },
    ],
  },
  oxc: { jsx: { runtime: 'automatic' } },
  server: { host: '127.0.0.1', port: 4318, strictPort: true },
};
