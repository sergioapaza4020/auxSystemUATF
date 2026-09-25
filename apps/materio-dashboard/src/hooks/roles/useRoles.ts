'use client';

import { useCallback, useEffect, useState } from 'react';

import { getRoles } from '@/api/roles.service';

import type { IRole } from '@/interfaces/roles/role.interface';

export function useRoles() {
  const [roles, setRoles] = useState<IRole[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const data = await getRoles();

      setRoles(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    roles,
    loading,
    load,
  };
}
