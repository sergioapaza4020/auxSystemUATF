export const QR_ENTRY_ROUTE = '/attendance/qr';
export const PUBLIC_ROUTES = ['/login', '/verify-account', QR_ENTRY_ROUTE];

export const isPublicRoute = (path: string) =>
  path === QR_ENTRY_ROUTE || PUBLIC_ROUTES.some((route) => route !== QR_ENTRY_ROUTE && path.startsWith(route));
