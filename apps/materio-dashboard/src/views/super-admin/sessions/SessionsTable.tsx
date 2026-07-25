'use client';

import { useEffect, useMemo, useState } from 'react';

import DeleteIcon from '@mui/icons-material/Delete';
import Swal, { type SweetAlertTheme } from 'sweetalert2';

import {
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
import { sessionHeadCellsData } from '@/views/super-admin/sessions/data/head-cells.data';
import type { Order } from '@/components/table/types/order';
import { getComparator } from '@/components/table/utils/getComparator';
import { getSessionActivity } from '@/views/super-admin/sessions/utils/getSessionActivity';
import type { SortableColumn } from './types/sortableColumn';
import { LoadingTable } from '@/components/loading-skeletons/table/LoadingTable';
import { useSettings } from '@/@core/hooks/useSettings';

export const SessionsTable = () => {
  const [sessions, setSessions] = useState<ISession[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const [order, setOrder] = useState<Order>('desc');
  const [orderBy, setOrderBy] = useState<SortableColumn>('idSession');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);

  const { settings } = useSettings();

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

  if (loading) return <LoadingTable />;

  const handleOpenDeleteButton = async (username: string, idSession: number) => {
    let themeMode: SweetAlertTheme = 'light';

    if (settings.mode) themeMode = settings.mode;

    const result = await Swal.fire({
      theme: `${themeMode}`,
      title: `Revocando la sesión de ${username}`,
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

      await Swal.fire({
        theme: `${themeMode}`,
        title: 'Sesión revocada con éxito',
        text: '',
        icon: 'success',
      });
    } catch (error) {
      console.error(error);

      await Swal.fire({
        theme: `${themeMode}`,
        title: 'Error al revocar la sesión',
        text: '',
        icon: 'success',
      });
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
    <Paper sx={{ width: '100%', mb: 2 }}>
      <TableContainer>
        <Table sx={{ minWidth: 750 }} aria-label='sessions-table'>
          <EnhancedTableHead<ISession>
            headCells={sessionHeadCellsData}
            order={order}
            orderBy={orderBy}
            onRequestSort={handleRequestSort}
          />
          <TableBody>
            {visibleRows.map((session: ISession) => {
              const isDeleteDisabled = !session.isActive || session.idSession === user?.idSession;

              return (
                <TableRow
                  key={session.idSession}
                  hover={session.isActive && user?.idSession !== session.idSession}
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
                    <Tooltip
                      title='Eliminar'
                      slots={{ transition: Zoom }}
                      disableHoverListener={isDeleteDisabled}
                      disableFocusListener={isDeleteDisabled}
                      disableTouchListener={isDeleteDisabled}
                    >
                      <span>
                        <IconButton
                          onClick={() => handleOpenDeleteButton(session.user.username, session.idSession)}
                          disabled={isDeleteDisabled}
                        >
                          <DeleteIcon color={!isDeleteDisabled ? 'error' : 'disabled'} />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              );
            })}
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
        slotProps={{
          select: {
            MenuProps: {
              PaperProps: {
                sx: {
                  '& .MuiMenuItem-root.Mui-selected': {
                    ...(settings.mode === 'dark' && { color: '#fff' }),
                  },
                },
              },
            },
          },
        }}
      />
    </Paper>
  );
};
