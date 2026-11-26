import { instance } from '@/api/config/config';

type Operation = 'request' | 'resend' | 'verify' | 'reset';
type RecoveryReply = { message: string; retryAfter?: number };

export async function passwordRecovery(operation: Operation, body: Record<string, string> = {}) {
  const path = operation === 'reset' ? '/forgot-password/reset/submit' : `/api/auth/password-recovery/${operation}`;
  const url = new URL(path, window.location.origin).toString();

  const { data } = await instance.post<RecoveryReply>(url, body, {
    headers: { 'X-UATF-CSRF': '1' },
  });

  return data;
}
