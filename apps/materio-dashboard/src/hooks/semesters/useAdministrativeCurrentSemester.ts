'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import axios from 'axios';

import { getCurrentSemester } from '@/api/semesters.service';
import { getApiErrorMessage } from '@/utils/http/getApiErrorMessage';

export function useAdministrativeCurrentSemester(enabled: boolean) {
  const [currentId, setCurrentId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const requestId = useRef(0);

  const load = useCallback(async () => {
    if (!enabled) return;
    const id = ++requestId.current;

    setLoading(true);
    setError('');

    try {
      const semester = await getCurrentSemester();

      if (id === requestId.current) setCurrentId(semester.idSemester);
    } catch (cause) {
      if (id !== requestId.current) return;
      setCurrentId(null);

      if (!(axios.isAxiosError(cause) && cause.response?.status === 404)) {
        setError(getApiErrorMessage(cause));
      }
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [enabled]);

  const invalidateRequests = useCallback(() => {
    requestId.current++;
  }, []);

  useEffect(() => {
    void load();
    const timer = enabled ? window.setInterval(() => void load(), 60000) : undefined;

    return () => {
      window.clearInterval(timer);
      invalidateRequests();
    };
  }, [enabled, load, invalidateRequests]);

  return { currentId, loading, error, load };
}
