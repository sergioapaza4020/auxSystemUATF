'use client';

import { useEffect, useRef } from 'react';

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

export const SessionsTable = () => {
  const { user } = useAuth();
  const dialog = useDialog();

  const { sessions, loading, load, meta, error, changeQuery } = useSessions();
  const snackbar = useSnackbar();
  const notification = useRef(snackbar);

  notification.current = snackbar;
  useEffect(() => {
    if (error) notification.current.error(error);
  }, [error]);

  if (loading && !sessions.length) return <LoadingTable />;

  const handleOpenDeleteButton = async (idSession: number) => {
    const confirmed = await dialog.confirm({
      title: `Revocando la sesión de ${user?.username}`,
      text: '¿Estás seguro? Esta acción no se puede deshacer',
    });

    if (!confirmed) return;

    try {
      await revokeSessionById(idSession);

      load();

      await dialog.success('Sesión revocada con éxito');
    } catch (error) {
      await dialog.error('No se pudo revocar la sesión');

      throw error;
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
                onDelete={() => handleOpenDeleteButton(session.idSession)}
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
