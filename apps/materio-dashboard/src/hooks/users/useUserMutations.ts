'use client';

import { useRef, useState } from 'react';

import { useDialog } from '@/hooks/useDialog';
import { useSnackbar } from '@/hooks/useSnackbar';
import type { ConfirmDialogOptions } from '@/contexts/DialogContext';
import { getApiErrorMessage } from '@/utils/http/getApiErrorMessage';

export function useUserMutations(reload: () => void) {
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const dialog = useDialog();
  const snackbar = useSnackbar();

  const run = async (
    action: () => Promise<void>,
    message: string,
    onSuccess?: () => void,
    confirmation?: ConfirmDialogOptions,
  ) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');

    try {
      if (confirmation && !(await dialog.confirm(confirmation))) return;
      await action();
      onSuccess?.();
      snackbar.success(message);
      reload();
    } catch (cause) {
      const message = getApiErrorMessage(cause);

      setError(message);
      snackbar.error(message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  return { busy, error, run, clearError: () => setError('') };
}
