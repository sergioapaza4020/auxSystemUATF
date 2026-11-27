import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { REFRESH_COOKIE } from '@/server/auth-handler';

export const dynamic = 'force-dynamic';

export function GET(request: NextRequest) {
  const hasSession = Boolean(request.cookies.get(REFRESH_COOKIE)?.value || request.cookies.get('refreshToken')?.value);

  return NextResponse.json(
    { hasSession },
    {
      headers: { 'Cache-Control': 'no-store, private', Pragma: 'no-cache' },
    },
  );
}
