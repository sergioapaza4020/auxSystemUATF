'use client';

import { useEffect, useState } from 'react';

import { getCareers } from '@/api/careers.service';
import type { ICareer } from '@/interfaces/careers/career.interface';
import { getApiErrorMessage } from '@/utils/http/getApiErrorMessage';

export function useCareerStudentImportContext(id: number, enabled: boolean) {
  const [career, setCareer] = useState<ICareer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();

    setCareer(null);
    setError('');
    setLoading(true);
    getCareers('all', controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setCareer(data.find((item) => item.idCareer === id) ?? null);
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setError(getApiErrorMessage(cause));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [id, enabled, attempt]);

  return { career, loading, error, retry: () => setAttempt((value) => value + 1) };
}
