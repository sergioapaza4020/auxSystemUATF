import { GradeSchemesTable } from '@/views/admin/grade-schemes/GradeSchemesTable';
import { PermissionGate } from '@/components/auth/PermissionGate';

export default function GradeSchemes() {
  return (
    <PermissionGate permission='grade-scheme.get-all'>
      <GradeSchemesTable />
    </PermissionGate>
  );
}
