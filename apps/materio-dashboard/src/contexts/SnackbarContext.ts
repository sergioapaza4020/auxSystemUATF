'use client';

import type { ReactNode } from 'react';
import { createContext } from 'react';

import type { AlertColor } from '@mui/material';

export interface SnackbarState {
  open: boolean;
  severity: AlertColor;
  message: string;
  autoHideDuration: number;
  action?: ReactNode;
}

export interface SnackbarContextType {
  snackbar: SnackbarState;

  success: (message: string, action?: ReactNode, duration?: number) => void;
  error: (message: string, action?: ReactNode, duration?: number) => void;
  warning: (message: string, action?: ReactNode, duration?: number) => void;
  info: (message: string, action?: ReactNode, duration?: number) => void;

  closeSnackbar: () => void;
}

export const SnackbarContext = createContext<SnackbarContextType | null>(null);
