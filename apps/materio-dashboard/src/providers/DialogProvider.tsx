'use client';

import { type PropsWithChildren, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { AppConfirmDialog } from '@/components/feedback/AppConfirmDialog';
import { DialogContext, type ConfirmDialogOptions } from '@/contexts/DialogContext';
import { useSnackbar } from '@/hooks/useSnackbar';

interface ConfirmationRequest {
  options: ConfirmDialogOptions;
  resolve: (confirmed: boolean) => void;
}

export function DialogProvider({ children }: PropsWithChildren) {
  const { success: notifySuccess, error: notifyError, warning: notifyWarning, info: notifyInfo } = useSnackbar();
  const requests = useRef<ConfirmationRequest[]>([]);
  const mounted = useRef(true);
  const [active, setActive] = useState<ConfirmationRequest | null>(null);

  useEffect(() => {
    const pendingRequests = requests.current;

    mounted.current = true;

    return () => {
      mounted.current = false;
      pendingRequests.splice(0).forEach((request) => request.resolve(false));
    };
  }, []);

  const confirm = useCallback((options: ConfirmDialogOptions): Promise<boolean> => {
    if (!mounted.current) return Promise.resolve(false);

    return new Promise<boolean>((resolve) => {
      const request = { options, resolve };

      requests.current.push(request);

      if (requests.current.length === 1) setActive(request);
    });
  }, []);

  const settle = useCallback((request: ConfirmationRequest, confirmed: boolean) => {
    // Ignore duplicate clicks or callbacks from a confirmation that already closed.
    if (requests.current[0] !== request) return;

    requests.current.shift();
    setActive(requests.current[0] ?? null);
    request.resolve(confirmed);
  }, []);

  // Preserve the async API; notifications resolve when requested, not when dismissed.
  const success = useCallback(
    async (title: string, text?: string) => {
      notifySuccess(text ? `${title}: ${text}` : title);
    },
    [notifySuccess],
  );

  const error = useCallback(
    async (title: string, text?: string) => {
      notifyError(text ? `${title}: ${text}` : title);
    },
    [notifyError],
  );

  const warning = useCallback(
    async (title: string, text?: string) => {
      notifyWarning(text ? `${title}: ${text}` : title);
    },
    [notifyWarning],
  );

  const info = useCallback(
    async (title: string, text?: string) => {
      notifyInfo(text ? `${title}: ${text}` : title);
    },
    [notifyInfo],
  );

  const value = useMemo(() => ({ confirm, success, error, warning, info }), [confirm, success, error, warning, info]);

  return (
    <DialogContext.Provider value={value}>
      {children}
      {active && <AppConfirmDialog options={active.options} onClose={(confirmed) => settle(active, confirmed)} />}
    </DialogContext.Provider>
  );
}
