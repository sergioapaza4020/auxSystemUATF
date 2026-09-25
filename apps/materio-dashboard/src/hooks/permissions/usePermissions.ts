'use client';

import { useCallback, useEffect, useState } from 'react';

import { getPermissions } from '@/api/roles.service';

import type { IPermission } from '@/interfaces/permissions/permission.interface';

export function usePermissions() {
  const [permissions, setPermissions] = useState<IPermission[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const data = await getPermissions();

      setPermissions(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    permissions,
    loading,
    load,
  };
}
