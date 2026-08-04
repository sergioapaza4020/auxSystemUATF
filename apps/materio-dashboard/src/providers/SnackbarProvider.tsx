'use client';

import { type ReactNode, type PropsWithChildren, useCallback, useState } from 'react';

import type { AlertColor } from '@mui/material';

import { SnackbarContext, type SnackbarState } from '../contexts/SnackbarContext';
import { AppSnackbar } from '@/components/feedback/AppSnackbar';

export function SnackbarProvider({ children }: PropsWithChildren) {
  const [snackbar, setSnackbar] = useState<SnackbarState>({
    open: false,
    severity: 'success',
    message: '',
    autoHideDuration: 5000,
  });

  const show = useCallback((severity: AlertColor, action: ReactNode, message: string, duration = 5000) => {
    setSnackbar({
      open: true,
      severity,
      action,
      message,
      autoHideDuration: duration,
    });
  }, []);

  const success = useCallback(
    (message: string, action?: ReactNode, duration?: number) => show('success', action, message, duration),
    [show],
  );

  const error = useCallback(
    (message: string, action?: ReactNode, duration?: number) => show('error', action, message, duration),
    [show],
  );

  const warning = useCallback(
    (message: string, action?: ReactNode, duration?: number) => show('warning', action, message, duration),
    [show],
  );

  const info = useCallback(
    (message: string, action?: ReactNode, duration?: number) => show('info', action, message, duration),
    [show],
  );

  const closeSnackbar = useCallback(() => {
    setSnackbar((prev) => ({
      ...prev,
      open: false,
    }));
  }, []);

  return (
    <SnackbarContext.Provider
      value={{
        snackbar,
        success,
        error,
        warning,
        info,
        closeSnackbar,
      }}
    >
      {children}

      <AppSnackbar snackbar={snackbar} onClose={closeSnackbar} />
    </SnackbarContext.Provider>
  );
}
