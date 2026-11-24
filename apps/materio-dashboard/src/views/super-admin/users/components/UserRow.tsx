import { Chip, Stack, TableCell, TableRow, Typography } from '@mui/material';

import { StatusChip, TableActions, TableAction } from '@/components/table';
import type { IUser } from '@/interfaces/users/user.interface';

interface Props {
  user: IUser;
  busy: boolean;
  onView: () => void;
  onEdit?: () => void;
  onDeactivate?: () => void;
  onReactivate?: () => void;
  onAddRoles?: () => void;
}

export function UserRow({ user, busy, onView, onEdit, onDeactivate, onReactivate, onAddRoles }: Props) {
  return (
    <TableRow hover>
      <TableCell>
        <Typography>
          {user.name} {user.lastname}
        </Typography>
        <Typography variant='caption' color='text.secondary'>
          {user.username}
        </Typography>
      </TableCell>
      <TableCell>
        <Typography variant='body2'>CI: {user.ci}</Typography>
        <Typography variant='caption'>RU: {user.ru || '—'}</Typography>
      </TableCell>
      <TableCell sx={{ maxWidth: 260, overflowWrap: 'anywhere' }}>{user.email}</TableCell>
      <TableCell>
        <Stack direction='row' gap={1} flexWrap='wrap'>
          {user.roles?.length
            ? user.roles.map((role) => (
                <Chip key={role.idRole} size='small' label={`${role.name}${role.isActive ? '' : ' (inactivo)'}`} />
              ))
            : 'Sin roles'}
        </Stack>
      </TableCell>
      <TableCell>
        <StatusChip active={user.isActive} />
      </TableCell>
      <TableCell>
        <Stack direction='row' alignItems='center' justifyContent='center' spacing={0.75}>
          <TableAction
            intent='view'
            label='Ver usuario'
            aria-label={`Ver usuario ${user.username}`}
            disabled={busy}
            onClick={onView}
          />
          {user.isActive && onAddRoles && (
            <TableAction
              intent='assign'
              label='Añadir roles'
              aria-label={`Añadir roles a ${user.username}`}
              disabled={busy}
              onClick={onAddRoles}
            />
          )}
          <TableActions
            active={user.isActive}
            disabled={busy}
            onEdit={onEdit}
            onDelete={onDeactivate}
            onRestore={onReactivate}
          />
        </Stack>
      </TableCell>
    </TableRow>
  );
}
