'use client';

import { useEffect, useState } from 'react';

import type { IRoleCreate } from '@/interfaces/roles/role.interface';

const emptyRole: IRoleCreate = {
  name: '',
  description: '',
  permissionNames: [],
};

interface UseRoleFormProps {
  initialValue?: IRoleCreate;
}

export function useRoleForm({ initialValue }: UseRoleFormProps = {}) {
  const [role, setRole] = useState<IRoleCreate>(initialValue ?? emptyRole);

  useEffect(() => {
    setRole(initialValue ?? emptyRole);
  }, [initialValue]);

  const updateField = (field: keyof IRoleCreate, value: string | string[]) => {
    setRole((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handlePermissionChange = (permissionName: string) => {
    setRole((current) => {
      const exists = current.permissionNames.includes(permissionName);

      return {
        ...current,
        permissionNames: exists
          ? current.permissionNames.filter((name) => name !== permissionName)
          : [...current.permissionNames, permissionName],
      };
    });
  };

  const isValid = role.name.trim().length > 0;

  return {
    role,
    updateField,
    handlePermissionChange,
    isValid,
  };
}
