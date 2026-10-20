import { SessionsTable } from '@/views/super-admin/sessions/SessionsTable';
import { PermissionGate } from '@/components/auth/PermissionGate';

export default function Sessions() {
  return (
    <PermissionGate permission='session.get-all'>
      <SessionsTable />
    </PermissionGate>
  );
}
