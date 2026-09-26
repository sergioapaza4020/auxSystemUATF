'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { useDialog } from '@/hooks/useDialog';
import { useSnackbar } from '@/hooks/useSnackbar';
import type { ConfirmDialogOptions } from '@/contexts/DialogContext';
import { getApiErrorMessage } from '@/utils/http/getApiErrorMessage';

// Shared only by the semester and grade-item administrative catalogs.
export function useAdministrativeCatalog<T>(fetchRecords: () => Promise<T[]>, enabled: boolean) {
  const [records, setRecords] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [mutationError, setMutationError] = useState('');
  const requestId = useRef(0);
  const locked = useRef(false);
  const dialog = useDialog();
  const snackbar = useSnackbar();

  const load = useCallback(async () => {
    if (!enabled) return;
    const id = ++requestId.current;

    setLoading(true);
    setError('');

    try {
      const data = await fetchRecords();

      if (id === requestId.current) setRecords(data);
    } catch (cause) {
      if (id === requestId.current) setError(getApiErrorMessage(cause));
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [enabled, fetchRecords]);

  const invalidateRequests = useCallback(() => {
    requestId.current++;
  }, []);

  useEffect(() => {
    void load();

    return () => {
      invalidateRequests();
    };
  }, [load, invalidateRequests]);

  const mutate = async (
    action: () => Promise<void>,
    message: string,
    onSuccess?: () => void,
    confirmation?: ConfirmDialogOptions,
  ) => {
    if (locked.current || !enabled) return;
    locked.current = true;
    setBusy(true);
    setMutationError('');

    try {
      if (confirmation && !(await dialog.confirm(confirmation))) return;
      await action();
      onSuccess?.();
      snackbar.success(message);

      // A failed reload is a list error, never a failed mutation that invites duplicate submission.
      await load();
    } catch (cause) {
      const message = getApiErrorMessage(cause);

      setMutationError(message);
      snackbar.error(message);
    } finally {
      locked.current = false;
      setBusy(false);
    }
  };

  return { records, loading, error, busy, mutationError, clearMutationError: () => setMutationError(''), load, mutate };
}
