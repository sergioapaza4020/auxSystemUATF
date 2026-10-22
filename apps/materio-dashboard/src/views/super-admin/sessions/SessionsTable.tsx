'use client';

import { useEffect, useRef, useState } from 'react';

import { LinearProgress, Paper, Table, TableBody, TableContainer, TableHead, TableRow, TableCell } from '@mui/material';

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
    <Paper sx={{ width: '100%', mb: 2 }}>
      {loading && <LinearProgress />}
      <TableContainer>
        <Table sx={{ minWidth: 750 }} aria-label='sessions-table' aria-busy={loading}>
          <TableHead>
            <TableRow>
              {sessionHeadCellsData.map((column) => (
                <TableCell
                  key={column.id}
                  sx={{
                    py: 2,
                    bgcolor: 'action.hover',
                    color: 'text.secondary',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    letterSpacing: '0.02em',
                    whiteSpace: 'nowrap',
                    borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
                  }}
                >
                  {column.label}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
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
      </TableContainer>
      <PaginationTable
        count={meta.total}
        page={meta.page - 1}
        rowsPerPage={meta.limit}
        onPageChange={(_, page) => changeQuery({ page: page + 1 })}
        onRowsPerPageChange={(event) => changeQuery({ limit: Number(event.target.value) })}
      />
    </Paper>
  );
};
