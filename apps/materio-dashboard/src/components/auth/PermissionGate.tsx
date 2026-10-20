'use client';

import type { ReactNode } from 'react';

import Alert from '@mui/material/Alert';

import { useAuth } from '@/hooks/useAuth';
import { hasPermission } from '@/utils/hasPermission';
import { LoadingTable } from '@/components/skeletons/table/LoadingTable';

export function PermissionGate({ permission, children }: { permission: string; children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return <LoadingTable />;

  if (!hasPermission(user, permission)) {
    return <Alert severity='warning'>No tienes permiso para consultar esta sección.</Alert>;
  }

  return children;
}
