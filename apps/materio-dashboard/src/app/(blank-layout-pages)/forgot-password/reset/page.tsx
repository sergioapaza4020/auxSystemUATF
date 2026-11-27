import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { hasRecoveryProof, proofCookie } from '@/server/password-recovery';
import ForgotPassword from '@views/ForgotPassword';

export default function ResetPasswordPage() {
  if (!hasRecoveryProof(cookies().get(proofCookie)?.value ?? '')) redirect('/forgot-password');

  return <ForgotPassword step='reset' />;
}
