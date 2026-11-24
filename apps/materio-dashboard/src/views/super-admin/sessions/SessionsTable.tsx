'use client';

import { useEffect, useRef, useState } from 'react';

import { LinearProgress, Table, TableBody, TableHead, TableRow, TableCell, TextField } from '@mui/material';

import { DataTableContainer, DataTableSurface, TableMessageRow, TableToolbar } from '@/components/table';

import { revokeSessionById } from '@/api/sessions.service';

import { sessionHeadCellsData } from '@/views/super-admin/sessions/data/head-cells.data';

import { LoadingTable } from '@/components/skeletons/table/LoadingTable';
import { PaginationTable } from '@/components/table/components/PaginationTable';
import { SessionRow } from './components/SessionRow';

import { useAuth } from '@/hooks/useAuth';
import { useDialog } from '@/hooks/useDialog';

import { useSnackbar } from '@/hooks/useSnackbar';
import { useSessions } from '@/hooks/sessions';
import type { ISession } from '@/interfaces/sessions/session.interface';
import { hasPermission } from '@/utils/hasPermission';
import { getApiErrorMessage } from '@/utils/http/getApiErrorMessage';

export const SessionsTable = () => {
  const { user } = useAuth();
  const dialog = useDialog();
  const revoking = useRef(false);
  const [processing, setProcessing] = useState(false);

  const { sessions, loading, load, meta, error, changeQuery } = useSessions();
  const snackbar = useSnackbar();
  const notification = useRef(snackbar);

  notification.current = snackbar;
  useEffect(() => {
    if (error) notification.current.error(error);
  }, [error]);

  if (loading && !sessions.length) return <LoadingTable />;

  const handleOpenDeleteButton = async (session: ISession) => {
    if (
      revoking.current ||
      !hasPermission(user, 'sessions.revoke-one') ||
      !session.isActive ||
      session.idSession === user?.idSession
    )
      return;

    revoking.current = true;
    setProcessing(true);

    try {
      const confirmed = await dialog.confirm({
        title: `¿Cerrar la sesión de ${session.user.username}?`,
        text: 'El usuario perderá acceso en su próxima solicitud y tendrá que iniciar sesión nuevamente.',
        confirmButtonText: 'Cerrar sesión',
      });

      if (!confirmed) return;

      await revokeSessionById(session.idSession);

      load();
      snackbar.success('Sesión revocada con éxito');
    } catch (error) {
      snackbar.error(getApiErrorMessage(error));
    } finally {
      revoking.current = false;
      setProcessing(false);
    }
  };

  return (
    <DataTableSurface sx={{ width: '100%', mb: 2 }}>
      <TableToolbar onRefresh={load} refreshDisabled={loading || processing}>
        <TextField
          size='small'
          label='Buscar sesión'
          disabled
          helperText='La API de sesiones no admite búsqueda global.'
        />
      </TableToolbar>
      {loading && <LinearProgress />}
      <DataTableContainer>
        <Table sx={{ minWidth: 750 }} aria-label='sessions-table' aria-busy={loading}>
          <TableHead>
            <TableRow>
              {sessionHeadCellsData.map((column) => (
                <TableCell key={column.id}>{column.label}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {!loading && !sessions.length && <TableMessageRow colSpan={9}>{error || 'Sin registros'}</TableMessageRow>}
            {sessions.map((session) => (
              <SessionRow
                key={session.idSession}
                session={session}
                processing={processing || loading}
                onDelete={() => {
                  void handleOpenDeleteButton(session);
                }}
              />
            ))}
          </TableBody>
        </Table>
      </DataTableContainer>
      <PaginationTable
        count={meta.total}
        page={meta.page - 1}
        rowsPerPage={meta.limit}
        onPageChange={(_, page) => changeQuery({ page: page + 1 })}
        onRowsPerPageChange={(event) => changeQuery({ limit: Number(event.target.value) })}
      />
    </DataTableSurface>
  );
};
