'use client';

import { useEffect, useState } from 'react';

import { getMyEnrollment } from '@/api/enrollments.service';
import type { IEnrollment } from '@/interfaces/enrollments/enrollment.interface';
import { getApiErrorMessage } from '@/utils/http/getApiErrorMessage';

export function useEnrollmentImportContext(id: number, enabled: boolean) {
  const [enrollment, setEnrollment] = useState<IEnrollment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();

    setEnrollment(null);
    setError('');
    setLoading(true);
    getMyEnrollment(id, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setEnrollment(data);
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setError(getApiErrorMessage(cause));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [id, enabled, attempt]);

  return { enrollment, loading, error, retry: () => setAttempt((value) => value + 1) };
}
