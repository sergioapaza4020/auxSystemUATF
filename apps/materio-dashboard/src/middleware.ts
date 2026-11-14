import { type NextRequest, NextResponse } from 'next/server';

import { isPublicRoute, QR_ENTRY_ROUTE } from './configs/publicRoutes';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('accessToken')?.value;

  const publicRoute = isPublicRoute(request.nextUrl.pathname);

  if (!token && !publicRoute) return NextResponse.redirect(new URL('/login', request.url));

  const response = NextResponse.next();

  if (request.nextUrl.pathname === QR_ENTRY_ROUTE) {
    response.headers.set('Cache-Control', 'no-store');
    response.headers.set('Referrer-Policy', 'no-referrer');
  }

  return response;
}

export const config = {
  matcher: ['/((?!api|_next|.*\\..*).*)'],
};
