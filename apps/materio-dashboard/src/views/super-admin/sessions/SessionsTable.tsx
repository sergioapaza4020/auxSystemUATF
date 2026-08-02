'use client';

import { useEffect, useMemo, useState } from 'react';

import { Paper, Table, TableBody, TableContainer } from '@mui/material';

import { getAllSessions, revokeSessionById } from '@/api/sessions.service';
import type { ISession } from '@/interfaces/sessions/session.interface';
import { useAuth } from '@/hooks/useAuth';
import { EnhancedTableHead } from '@/components/table/components/HeaderTable';
import { sessionHeadCellsData } from '@/views/super-admin/sessions/data/head-cells.data';
import type { Order } from '@/components/table/types/order';
import { getComparator } from '@/components/table/utils/getComparator';
import { LoadingTable } from '@/components/skeletons/table/LoadingTable';
import { useSettings } from '@/@core/hooks/useSettings';
import type { SortableIds } from '@/components/table/types/sortableIds';
import { PaginationTable } from '@/components/table/components/PaginationTable';
import { SessionRow } from './components/SessionRow';
import { useDialog } from '@/hooks/useDialog';

type OrderBy = SortableIds<ISession, typeof sessionHeadCellsData>;

export const SessionsTable = () => {
  const [sessions, setSessions] = useState<ISession[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const [order, setOrder] = useState<Order>('desc');
  const [orderBy, setOrderBy] = useState<OrderBy>('idSession');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);

  const { settings } = useSettings();

  const visibleRows = useMemo(
    () => [...sessions].sort(getComparator(order, orderBy)).slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage),
    [sessions, order, orderBy, page, rowsPerPage],
  );

  const { user } = useAuth();
  const dialog = useDialog();

  useEffect(() => {
    const loadSessions = async () => {
      try {
        const sessions = await getAllSessions();

        setSessions(sessions);
      } catch (error) {
        console.error(error);
      }

      setLoading(false);
    };

    void loadSessions();
  }, []);

  if (loading) return <LoadingTable />;

  const handleOpenDeleteButton = async (idSession: number) => {
    const confirmed = await dialog.confirm({
      title: `Revocando la sesión de ${user?.username}`,
      text: '¿Estás seguro? Esta acción no se puede deshacer',
    });

    if (!confirmed) return;

    try {
      await revokeSessionById(idSession);

      setSessions((prevSessions) =>
        prevSessions.map((session) =>
          session.idSession === idSession
            ? {
                ...session,
                isActive: false,
              }
            : session,
        ),
      );

      await dialog.success('Sesión revocada con éxito');
    } catch (error: any) {
      console.error(error.response.data);

      await dialog.error('No se pudo revocar la sesión');

      throw error;
    }
  };

  const handleRequestSort = (event: React.MouseEvent<unknown>, property: OrderBy) => {
    const isAsc = orderBy === property && order === 'asc';

    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
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
            {visibleRows.map((session: ISession) => {
              return (
                <SessionRow
                  key={session.idSession}
                  session={session}
                  onDelete={() => handleOpenDeleteButton(session.idSession)}
                />
              );
            })}
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
