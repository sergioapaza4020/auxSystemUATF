import { Stack, TableCell, TableRow, Typography } from '@mui/material';

import { StatusChip, TableActions } from '@/components/table';
import type { IGradeItem } from '@/interfaces/grade-items/grade-item.interface';
import { isAttendanceItem } from '../grade-item-rules';

interface Props {
  item: IGradeItem;
  busy: boolean;
  onEdit?: () => void;
  onDeactivate?: () => void;
  onReactivate?: () => void;
}

export function GradeItemRow({ item, busy, onEdit, onDeactivate, onReactivate }: Props) {
  const protectedItem = isAttendanceItem(item.name);

  return (
    <TableRow hover>
      <TableCell sx={{ overflowWrap: 'anywhere' }}>
        <Stack spacing={0.5}>
          <Typography>{item.name}</Typography>
          {protectedItem && (
            <Typography variant='caption' color='text.secondary'>
              Protegido: utilizado por el registro de asistencia.
            </Typography>
          )}
        </Stack>
      </TableCell>
      <TableCell>
        <StatusChip active={item.isActive} />
      </TableCell>
      <TableCell align='center'>
        {protectedItem && item.isActive ? (
          <Typography variant='caption'>Nombre y estado protegidos</Typography>
        ) : (
          <TableActions
            active={item.isActive}
            disabled={busy}
            onEdit={protectedItem ? undefined : onEdit}
            onDelete={protectedItem ? undefined : onDeactivate}
            onRestore={onReactivate}
          />
        )}
      </TableCell>
    </TableRow>
  );
}
