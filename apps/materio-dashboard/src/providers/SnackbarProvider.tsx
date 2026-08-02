'use client';

import { type PropsWithChildren, useCallback, useState } from 'react';

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

  const show = useCallback((severity: AlertColor, message: string, duration = 5000) => {
    setSnackbar({
      open: true,
      severity,
      message,
      autoHideDuration: duration,
    });
  }, []);

  const success = useCallback((message: string, duration?: number) => show('success', message, duration), [show]);

  const error = useCallback((message: string, duration?: number) => show('error', message, duration), [show]);

  const warning = useCallback((message: string, duration?: number) => show('warning', message, duration), [show]);

  const info = useCallback((message: string, duration?: number) => show('info', message, duration), [show]);

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
