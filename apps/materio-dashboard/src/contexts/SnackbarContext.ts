'use client';

import { createContext } from 'react';

import type { AlertColor } from '@mui/material';

export interface SnackbarState {
  open: boolean;
  severity: AlertColor;
  message: string;
  autoHideDuration: number;
  action?: React.ReactNode;
}

export interface SnackbarContextType {
  snackbar: SnackbarState;

  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;

  closeSnackbar: () => void;
}

export const SnackbarContext = createContext<SnackbarContextType | null>(null);
