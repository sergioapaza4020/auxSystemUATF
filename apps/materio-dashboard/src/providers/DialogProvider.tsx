'use client';

import { type PropsWithChildren, useCallback } from 'react';

import Swal, { type SweetAlertTheme } from 'sweetalert2';

import { useSettings } from '@/@core/hooks/useSettings';

import { DialogContext, type ConfirmDialogOptions } from '@/contexts/DialogContext';

export function DialogProvider({ children }: PropsWithChildren) {
  const { settings } = useSettings();

  const theme: SweetAlertTheme = settings.mode === 'dark' ? 'dark' : 'light';

  const confirm = useCallback(
    async (options: ConfirmDialogOptions) => {
      const result = await Swal.fire({
        theme,
        icon: 'warning',
        title: options.title,
        text: options.text,
        showCancelButton: true,
        confirmButtonText: options.confirmButtonText ?? 'Aceptar',
        cancelButtonText: options.cancelButtonText ?? 'Cancelar',
      });

      return result.isConfirmed;
    },
    [theme],
  );

  const success = useCallback(
    async (title: string, text?: string) => {
      await Swal.fire({
        theme,
        icon: 'success',
        title,
        text,
      });
    },
    [theme],
  );

  const error = useCallback(
    async (title: string, text?: string) => {
      await Swal.fire({
        theme,
        icon: 'error',
        title,
        text,
      });
    },
    [theme],
  );

  const warning = useCallback(
    async (title: string, text?: string) => {
      await Swal.fire({
        theme,
        icon: 'warning',
        title,
        text,
      });
    },
    [theme],
  );

  const info = useCallback(
    async (title: string, text?: string) => {
      await Swal.fire({
        theme,
        icon: 'info',
        title,
        text,
      });
    },
    [theme],
  );

  return (
    <DialogContext.Provider
      value={{
        confirm,
        success,
        error,
        warning,
        info,
      }}
    >
      {children}
    </DialogContext.Provider>
  );
}
