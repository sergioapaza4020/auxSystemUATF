import { TableCell, TableRow } from '@mui/material';

import type { IRole } from '@/interfaces/roles/role.interface';
import { ChipList, StatusChip, TableActions } from '@/components/table';

interface RoleRowProps {
  role: IRole;
  loadingEdit?: boolean;
  disableEdit?: boolean;
  onEdit: (role: IRole) => void;
  onDelete: (role: IRole) => void;
  onRestore: (role: IRole) => void;
}

export function RoleRow({ role, loadingEdit = false, disableEdit = false, onEdit, onDelete, onRestore }: RoleRowProps) {
  return (
    <TableRow hover>
      <TableCell>{role.name}</TableCell>

      <TableCell>{role.description || 'No disponible'}</TableCell>

      <TableCell>
        <ChipList
          items={role.permissions ?? []}
          getLabel={(permission) => permission.name}
          keyExtractor={(permission) => permission.idPermission}
        />
      </TableCell>

      <TableCell>
        <StatusChip active={role.isActive} />
      </TableCell>

      <TableCell align='center'>
        <TableActions
          active={role.isActive}
          loadingEdit={loadingEdit}
          disabled={loadingEdit}
          disableEdit={disableEdit}
          onEdit={() => onEdit(role)}
          onDelete={() => onDelete(role)}
          onRestore={() => onRestore(role)}
        />
      </TableCell>
    </TableRow>
  );
}
