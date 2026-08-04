'use client';

import { useCallback, useEffect, useState } from 'react';

import { getAllSessions } from '@/api/sessions.service';

import type { ISession } from '@/interfaces/sessions/session.interface';
import { useSnackbar } from '../useSnackbar';
import { getApiErrorMessage } from '@/utils/http/getApiErrorMessage';

export function useSessions() {
  const [sessions, setSessions] = useState<ISession[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const snackbar = useSnackbar();

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const data = await getAllSessions();

      setSessions(data);
    } catch (error) {
      snackbar.error(getApiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [snackbar]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    sessions,
    loading,

    load,
  };
}
