import type { Metadata } from 'next';

import VerifyEmailChange from '@/views/VerifyEmailChange';

export const metadata: Metadata = {
  title: 'Confirmar correo electrónico',
  referrer: 'no-referrer',
  robots: { index: false, follow: false },
};

export default function VerifyEmailChangePage() {
  return <VerifyEmailChange />;
}
