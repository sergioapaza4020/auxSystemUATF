import { Stack } from '@mui/material';

import { TableAction } from './TableAction';

interface TableActionsProps {
  active: boolean;
  loadingEdit?: boolean;
  disabled?: boolean;
  disableEdit?: boolean;
  deleteLabel?: string;
  onEdit?: () => void;
  onDelete?: () => void;
  onRestore?: () => void;
}

export function TableActions({
  active,
  loadingEdit,
  disabled,
  disableEdit,
  onEdit,
  onDelete,
  onRestore,
  deleteLabel = 'Desactivar',
}: TableActionsProps) {
  return (
    <Stack direction='row' alignItems='center' justifyContent='center' spacing={0.75}>
      {active && onEdit && (
        <TableAction
          intent='edit'
          label='Editar'
          disabled={disableEdit || disabled}
          loading={loadingEdit}
          onClick={onEdit}
        />
      )}
      {active && onDelete && (
        <TableAction
          intent={deleteLabel === 'Desactivar' ? 'deactivate' : deleteLabel === 'Cerrar sesión' ? 'close' : 'delete'}
          label={deleteLabel}
          disabled={disabled}
          onClick={onDelete}
        />
      )}
      {!active && onRestore && (
        <TableAction intent='restore' label='Restaurar' disabled={disabled} onClick={onRestore} />
      )}
    </Stack>
  );
}
