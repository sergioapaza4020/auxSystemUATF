'use client';

import { useEffect, useState } from 'react';

import {
  Alert,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';

import { getUserById } from '@/api/users.service';
import { StatusChip } from '@/components/table';
import { LoadingTable } from '@/components/skeletons/table/LoadingTable';
import type { IUser } from '@/interfaces/users/user.interface';
import { getApiErrorMessage } from '@/utils/http/getApiErrorMessage';

interface Props {
  user: IUser;
  canFetch: boolean;
  onClose: () => void;
}

export function UserDetailsDialog({ user, canFetch, onClose }: Props) {
  const [record, setRecord] = useState(user);
  const [loading, setLoading] = useState(canFetch && user.isActive);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!canFetch || !user.isActive) return;
    const controller = new AbortController();

    setLoading(true);
    setError('');
    void getUserById(user.idUser, controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        if (data) setRecord(data);
        else setError('El usuario ya no está disponible como activo. Actualiza el listado.');
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setError(getApiErrorMessage(cause));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [canFetch, user, revision]);

  return (
    <Dialog open fullWidth maxWidth='sm' onClose={onClose} aria-labelledby='user-detail-title'>
      <DialogTitle id='user-detail-title'>Detalle de usuario</DialogTitle>
      <DialogContent>
        {loading ? (
          <LoadingTable />
        ) : error ? (
          <Alert
            severity='error'
            action={<Button onClick={() => setRevision((value) => value + 1)}>Reintentar</Button>}
          >
            {error}
          </Alert>
        ) : (
          <Stack spacing={2}>
            {(!canFetch || !user.isActive) && (
              <Alert severity='info'>Información de la última consulta del listado.</Alert>
            )}
            <Typography variant='h6'>
              {record.name} {record.lastname}
            </Typography>
            <Typography>Username: {record.username}</Typography>
            <Typography sx={{ overflowWrap: 'anywhere' }}>Email: {record.email}</Typography>
            <Typography>CI: {record.ci}</Typography>
            <Typography>RU: {record.ru || 'No registrado'}</Typography>
            <Stack direction='row'>
              <StatusChip active={record.isActive} />
            </Stack>
            <Typography variant='subtitle2'>Roles asignados</Typography>
            <Stack direction='row' flexWrap='wrap' gap={1}>
              {record.roles?.length ? (
                record.roles.map((role) => (
                  <Chip key={role.idRole} size='small' label={`${role.name}${role.isActive ? '' : ' (inactivo)'}`} />
                ))
              ) : (
                <Typography color='text.secondary'>Sin roles</Typography>
              )}
            </Stack>
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  );
}
