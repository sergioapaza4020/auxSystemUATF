import { RolesTable } from '@/views/super-admin/roles/RolesTable';
import { PermissionGate } from '@/components/auth/PermissionGate';

export default function RolesPage() {
  return (
    <PermissionGate permission='role.get-all'>
      <RolesTable />
    </PermissionGate>
  );
}
