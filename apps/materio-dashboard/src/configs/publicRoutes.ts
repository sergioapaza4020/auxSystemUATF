export const QR_ENTRY_ROUTE = '/attendance/qr';
export const EMAIL_VERIFICATION_ROUTE = '/account/verify-email';
export const PUBLIC_ROUTES = ['/login', '/verify-account', QR_ENTRY_ROUTE, '/forgot-password'];

export const isPublicRoute = (path: string) =>
  path === QR_ENTRY_ROUTE ||
  path === EMAIL_VERIFICATION_ROUTE ||
  path === '/forgot-password' ||
  path === '/forgot-password/verify' ||
  path === '/forgot-password/reset' ||
  path === '/forgot-password/reset/submit' ||
  PUBLIC_ROUTES.some((route) => route !== QR_ENTRY_ROUTE && path.startsWith(route));
