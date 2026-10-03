'use client';

import { useEffect, useState } from 'react';

import { getUserImportStatus } from '@/api/users.service';
import type { IUserImportExecution } from '@/interfaces/users/user-import.interface';
import { getApiErrorMessage } from '@/utils/http/getApiErrorMessage';
import { pollUserImport } from './userImportPolling';

export function useUserImportProgress(operationId: string | null, enabled: boolean) {
  const [execution, setExecution] = useState<IUserImportExecution | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setExecution(null);
    setError('');
    if (!operationId || !enabled) return;

    return pollUserImport(
      (signal) => getUserImportStatus(operationId, signal),
      (status) => {
        setExecution(status);
        setError('');
      },
      (cause) => setError(getApiErrorMessage(cause)),
    );
  }, [operationId, enabled]);

  return { execution, error };
}
