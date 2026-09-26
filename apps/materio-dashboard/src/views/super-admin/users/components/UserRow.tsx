import { Chip, IconButton, Stack, TableCell, TableRow, Tooltip, Typography } from '@mui/material';

import { StatusChip, TableActions } from '@/components/table';
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
        <Stack direction='row' alignItems='center' justifyContent='center'>
          <Tooltip title='Ver usuario'>
            <span>
              <IconButton aria-label={`Ver usuario ${user.username}`} disabled={busy} onClick={onView}>
                <i className='ri-eye-line' />
              </IconButton>
            </span>
          </Tooltip>
          {user.isActive && onAddRoles && (
            <Tooltip title='Añadir roles'>
              <span>
                <IconButton aria-label={`Añadir roles a ${user.username}`} disabled={busy} onClick={onAddRoles}>
                  <i className='ri-user-settings-line' />
                </IconButton>
              </span>
            </Tooltip>
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
