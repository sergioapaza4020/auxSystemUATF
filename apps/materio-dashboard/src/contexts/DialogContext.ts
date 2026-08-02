'use client';

import { createContext } from 'react';

export interface ConfirmDialogOptions {
  title: string;
  text?: string;
  confirmButtonText?: string;
  cancelButtonText?: string;
}

export interface DialogContextType {
  confirm(options: ConfirmDialogOptions): Promise<boolean>;
  success(title: string, text?: string): Promise<void>;
  error(title: string, text?: string): Promise<void>;
  warning(title: string, text?: string): Promise<void>;
  info(title: string, text?: string): Promise<void>;
}

export const DialogContext = createContext<DialogContextType | null>(null);
