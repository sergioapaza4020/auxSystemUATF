import { type NextRequest, NextResponse } from 'next/server';

import { PUBLIC_ROUTES } from './configs/publicRoutes';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('accessToken')?.value;

  const isPublicRoute = PUBLIC_ROUTES.some((route) => request.nextUrl.pathname.startsWith(route));

  if (!token && !isPublicRoute) return NextResponse.redirect(new URL('/login', request.url));

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next|.*\\..*).*)'],
};
