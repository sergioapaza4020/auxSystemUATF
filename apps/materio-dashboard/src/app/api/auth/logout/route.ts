import type { NextRequest } from 'next/server';

import { handleAuth } from '@/server/auth-handler';

export const dynamic = 'force-dynamic';
export const POST = (request: NextRequest) => handleAuth(request, 'logout');
