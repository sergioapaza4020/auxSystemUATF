'use client';

import { useState } from 'react';

import { createRole, deleteRole, reactivateRole, updateRole } from '@/api/roles.service';

import type { IRole, IRoleCreate } from '@/interfaces/roles/role.interface';

interface UseRoleMutationsProps {
  reload?: () => Promise<void> | void;
}

export function useRoleMutations({ reload }: UseRoleMutationsProps = {}) {
  const [loading, setLoading] = useState(false);

  const create = async (data: IRoleCreate): Promise<IRole> => {
    setLoading(true);

    try {
      const role = await createRole(data);

      await reload?.();

      return role;
    } finally {
      setLoading(false);
    }
  };

  const update = async (idRole: number, data: IRoleCreate): Promise<IRole> => {
    setLoading(true);

    try {
      const result = await updateRole(idRole, data);

      await reload?.();

      return result;
    } finally {
      setLoading(false);
    }
  };

  const remove = async (idRole: number) => {
    setLoading(true);

    try {
      const result = await deleteRole(idRole);

      await reload?.();

      return result;
    } finally {
      setLoading(false);
    }
  };

  const restore = async (idRole: number) => {
    setLoading(true);

    try {
      const result = await reactivateRole(idRole);

      await reload?.();

      return result;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    create,
    update,
    remove,
    restore,
  };
}
