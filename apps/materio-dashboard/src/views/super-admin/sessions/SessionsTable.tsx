'use client';

import { Paper, Table, TableBody, TableContainer } from '@mui/material';

import { revokeSessionById } from '@/api/sessions.service';
import type { ISession } from '@/interfaces/sessions/session.interface';

import { useSettings } from '@/@core/hooks/useSettings';

import { sessionHeadCellsData } from '@/views/super-admin/sessions/data/head-cells.data';

import { EnhancedTableHead } from '@/components/table/components/HeaderTable';
import { LoadingTable } from '@/components/skeletons/table/LoadingTable';
import { PaginationTable } from '@/components/table/components/PaginationTable';
import { SessionRow } from './components/SessionRow';

import { useAuth } from '@/hooks/useAuth';
import { useDialog } from '@/hooks/useDialog';

import { useDataTable } from '@/hooks/table';
import { useSessions } from '@/hooks/sessions';

export const SessionsTable = () => {
  const { settings } = useSettings();

  const { user } = useAuth();
  const dialog = useDialog();

  const { sessions, loading, load } = useSessions();

  const {
    order,
    orderBy,
    page,
    rowsPerPage,
    visibleRows,
    handleRequestSort,
    handleChangePage,
    handleChangeRowsPerPage,
  } = useDataTable<ISession, typeof sessionHeadCellsData>(sessions, 'idSession');

  if (loading) return <LoadingTable />;

  const handleOpenDeleteButton = async (idSession: number) => {
    const confirmed = await dialog.confirm({
      title: `Revocando la sesión de ${user?.username}`,
      text: '¿Estás seguro? Esta acción no se puede deshacer',
    });

    if (!confirmed) return;

    try {
      await revokeSessionById(idSession);

      await load();

      await dialog.success('Sesión revocada con éxito');
    } catch (error) {
      await dialog.error('No se pudo revocar la sesión');

      throw error;
    }
  };

  return (
    <Paper sx={{ width: '100%', mb: 2 }}>
      <TableContainer>
        <Table sx={{ minWidth: 750 }} aria-label='sessions-table'>
          <EnhancedTableHead<ISession, typeof sessionHeadCellsData>
            headCells={sessionHeadCellsData}
            order={order}
            orderBy={orderBy}
            onRequestSort={handleRequestSort}
          />
          <TableBody>
            {visibleRows.map((session) => (
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
        count={sessions.length}
        page={page}
        rowsPerPage={rowsPerPage}
        onPageChange={handleChangePage}
        onRowsPerPageChange={handleChangeRowsPerPage}
        darkMode={settings.mode === 'dark'}
      />
    </Paper>
  );
};
