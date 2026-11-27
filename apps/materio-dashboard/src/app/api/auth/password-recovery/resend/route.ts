import type { NextRequest } from 'next/server';

import { handleRecovery } from '@/server/password-recovery';

export const POST = (request: NextRequest) => handleRecovery(request, 'resend');
