'use client';

import { useCallback, useEffect, useState } from 'react';

import { getMyEnrollment } from '@/api/enrollments.service';
import type { IEnrollment } from '@/interfaces/enrollments/enrollment.interface';

export function useEnrollment(idEnrollment: number) {
  const [enrollment, setEnrollment] = useState<IEnrollment | null>(null);

  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const data = await getMyEnrollment(idEnrollment);

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
