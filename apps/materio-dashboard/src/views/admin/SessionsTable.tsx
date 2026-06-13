'use client';

import { useEffect, useMemo, useState } from 'react';

import DeleteIcon from '@mui/icons-material/Delete';
import Swal, { type SweetAlertTheme } from 'sweetalert2';
import Cookies from 'js-cookie';

import {
  Box,
  Chip,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TablePagination,
  TableRow,
  Tooltip,
  Zoom,
} from '@mui/material';

import { getAllSessions, revokeSessionById } from '@/api/sessions.service';
import type { ISession } from '@/interfaces/sessions/session.interface';
import { useAuth } from '@/hooks/useAuth';
import { EnhancedTableHead } from '@/components/table/HeaderTable';
import { headCellsData } from '@/components/table/data/headCells';
import type { Order } from '@/components/table/types/order';
import type { SortableColumn } from '@/components/table/types/sortableColumn';
import { getComparator } from '@/components/table/utils/getComparator';
import { getSessionActivity } from '@/components/table/utils/getSessionActivity';

export const SessionsTable = () => {
  const [sessions, setSessions] = useState<ISession[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const [order, setOrder] = useState<Order>('desc');
  const [orderBy, setOrderBy] = useState<SortableColumn>('idSession');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);

  const emptyRows = page > 0 ? Math.max(0, (1 + page) * rowsPerPage - sessions.length) : 0;

  const visibleRows = useMemo(
    () => [...sessions].sort(getComparator(order, orderBy)).slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage),
    [sessions, order, orderBy, page, rowsPerPage],
  );

  const { user } = useAuth();

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

  if (loading) return <h1>Cargando...</h1>;

  const handleOpenDeleteButton = async (username: string, idSession: number) => {
    const cookieVal = Cookies.get('materio-mui-next-free-demo');
    let themeMode: SweetAlertTheme = 'light';

    if (cookieVal) {
      const cookieObj = JSON.parse(cookieVal);

      themeMode = cookieObj.mode;
    }

    const result = await Swal.fire({
      theme: `${themeMode}`,
      title: `Eliminando la sesión de ${username}`,
      text: '¿Estás seguro?',
      icon: 'warning',
      showDenyButton: true,
      confirmButtonText: 'Si',
      denyButtonText: 'No',
    });

    if (!result.isConfirmed) return;

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

      await Swal.fire('Sesión eliminada con éxito', '', 'success');
    } catch (error) {
      console.error(error);

      await Swal.fire('Error al eliminar la sesión', '', 'error');
    }
  };

  const handleRequestSort = (event: React.MouseEvent<unknown>, property: SortableColumn) => {
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
    <Box sx={{ width: '100%' }}>
      <Paper sx={{ width: '100%', mb: 2 }}>
        <TableContainer>
          <Table sx={{ minWidth: 750 }} aria-label='sessions table'>
            <EnhancedTableHead
              headCells={headCellsData}
              order={order}
              orderBy={orderBy}
              onRequestSort={handleRequestSort}
            />
            <TableBody>
              {visibleRows.map((session: ISession) => {
                return (
                  <TableRow
                    hover
                    tabIndex={-1}
                    key={session.idSession}
                    sx={{ cursor: 'pointer', '&:last-child td, &:last-child th': { border: 0 } }}
                  >
                    <TableCell align='center' component='th' scope='row' padding='none'>
                      {session.idSession}
                    </TableCell>
                    <TableCell component='th' scope='row'>
                      {session.idSession !== user?.idSession ? session.user.username : 'Sesión actual'}
                    </TableCell>
                    <TableCell>{session.browser ? session.browser : 'No disponible'}</TableCell>
                    <TableCell>{session.os ? session.os : 'No disponible'}</TableCell>
                    <TableCell>{session.device ? session.device : 'No disponible'}</TableCell>
                    <TableCell align='center'>{session.ipAddress}</TableCell>
                    <TableCell align='center'>
                      {session.isActive ? (
                        <Chip label='Activo' color='success' />
                      ) : (
                        <Chip label='Inactivo' color='error' />
                      )}
                    </TableCell>
                    <TableCell align='center'>{getSessionActivity(session.lastUsedAt, session.isActive)}</TableCell>
                    <TableCell align='center'>
                      <Tooltip title='Eliminar' slots={{ transition: Zoom }}>
                        <IconButton
                          onClick={() => handleOpenDeleteButton(session.user.username, session.idSession)}
                          disabled={!session.isActive || session.idSession === user?.idSession}
                        >
                          <DeleteIcon
                            color={session.isActive && session.idSession !== user?.idSession ? 'error' : 'disabled'}
                          />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })}
              {emptyRows > 0 && (
                <TableRow>
                  <TableCell colSpan={6} />
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          labelRowsPerPage='Filas por página:'
          labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count}`}
          rowsPerPageOptions={[5, 10, 25]}
          component='div'
          count={sessions.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </Paper>
    </Box>
  );
};
