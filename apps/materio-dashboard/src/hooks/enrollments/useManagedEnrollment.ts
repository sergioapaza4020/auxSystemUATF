import { useCallback, useEffect, useState } from 'react';

import { getManagedEnrollment } from '@/api/enrollments.service';
import type { IEnrollment } from '@/interfaces/enrollments/enrollment.interface';

export function useManagedEnrollment(idEnrollment: number) {
  const [enrollment, setEnrollment] = useState<IEnrollment | null>(null);

  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const data = await getManagedEnrollment(idEnrollment);

      setEnrollment(data);
    } finally {
      setLoading(false);
    }
  }, [idEnrollment]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    enrollment,
    loading,
    load,
  };
}
