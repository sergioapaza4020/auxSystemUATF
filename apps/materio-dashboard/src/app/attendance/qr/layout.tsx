import type { ReactNode } from 'react';

import Providers from '@/components/Providers';
import BlankLayout from '@layouts/BlankLayout';

export default function QrLayout({ children }: { children: ReactNode }) {
  return (
    <Providers direction='ltr'>
      <BlankLayout>{children}</BlankLayout>
    </Providers>
  );
}
