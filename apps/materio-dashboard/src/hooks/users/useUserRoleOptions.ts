'use client';

import { useCallback, useEffect, useState } from 'react';

import { getRoles } from '@/api/roles.service';
import type { IRole } from '@/interfaces/roles/role.interface';
import { getApiErrorMessage } from '@/utils/http/getApiErrorMessage';

export function useUserRoleOptions(enabled: boolean) {
  const [roles, setRoles] = useState<IRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision((value) => value + 1), []);

  useEffect(() => {
    if (!enabled) return;
    let active = true;

    setLoading(true);
    setError('');
    void getRoles()
      .then((data) => {
        if (active) setRoles(data);
      })
      .catch((cause) => {
        if (active) setError(getApiErrorMessage(cause));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [enabled, revision]);

  return { roles, loading, error, reload };
}
