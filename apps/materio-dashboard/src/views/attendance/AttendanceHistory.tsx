import { useState } from 'react';

import {
  Box,
  Button,
  Chip,
  Menu,
  MenuItem,
  Card,
  CircularProgress,
  IconButton,
  LinearProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';

import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import MoreVertOutlinedIcon from '@mui/icons-material/MoreVertOutlined';

import { attendanceStatusColor } from '@/utils/attendance-status';
import { AttendanceStatus } from '@/enums/attendanceStatus';

import { PaginationTable, type HeadCell } from '@/components/table';
import { useDataTable } from '@/hooks/table/useDataTable';

interface AttendanceSession {
  idAttendanceSession: number;
  date: string;
  presentCount: number;
  excusedCount: number;
  absentCount: number;
  totalStudents: number;
  percentage: number;
}

const columns = [
  { id: 'date', label: 'Fecha', sortable: true },
] as const satisfies readonly HeadCell<AttendanceSession>[];

interface AttendanceHistoryProps {
  sessions: AttendanceSession[];
  loading: boolean;

  selectedSessionId: number | null;

  onSelectSession: (idSession: number) => void;
  onCreateSession?: () => void;
  disabled?: boolean;
  onEditDate?: (id: number) => void;
  onDeleteSession?: (id: number) => void;
}

export function AttendanceHistory({
  sessions,
  loading,
  selectedSessionId,
  onSelectSession,
  onCreateSession,
  disabled = false,
  onEditDate,
  onDeleteSession,
}: AttendanceHistoryProps) {
  const table = useDataTable<AttendanceSession, typeof columns>(sessions, 'date', 5, { preserveOrder: true });
  const [menu, setMenu] = useState<{ anchor: HTMLElement; sessionId: number } | null>(null);

  const formatDate = (date: string) => {
    const [year, month, day] = date.slice(0, 10).split('-');

    return `${day}/${month}/${year}`;
  };

  return (
    <Card>
      <Box sx={{ px: 3, pt: 2.5, pb: 2 }}>
        <Typography variant='h6' fontWeight={700}>
          Historial de asistencia
        </Typography>

        <Typography variant='body2' color='text.secondary'>
          Abre una sesión para revisar o ajustar su asistencia.
        </Typography>
      </Box>

      <Box sx={{ p: 2 }}>
        {loading ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <CircularProgress size={24} />
          </Box>
        ) : sessions.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography color='text.secondary' sx={{ mb: 2 }}>
              No hay sesiones de asistencia registradas.
            </Typography>
            {onCreateSession && (
              <Button variant='outlined' disabled={disabled} onClick={onCreateSession}>
                Crear primera sesión
              </Button>
            )}
          </Box>
        ) : (
          <TableContainer>
            <Table size='small' aria-label='Historial de asistencia' sx={{ minWidth: 720 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Fecha</TableCell>

                  <TableCell>Presentes</TableCell>

                  <TableCell>Permisos</TableCell>
                  <TableCell>Ausentes</TableCell>

                  <TableCell sx={{ width: 300 }}>Asistencia</TableCell>

                  <TableCell align='right'>Acciones</TableCell>
                </TableRow>
              </TableHead>

              <TableBody>
                {table.visibleRows.map((item) => {
                  const percentage = item.percentage;

                  const selected = selectedSessionId === item.idAttendanceSession;

                  return (
                    <TableRow key={item.idAttendanceSession} hover selected={selected}>
                      <TableCell>
                        <Typography variant='body2' fontWeight={selected ? 600 : 400}>
                          {formatDate(item.date)}
                        </Typography>
                        {selected && <Chip size='small' variant='outlined' label='En edición' sx={{ mt: 0.5 }} />}
                      </TableCell>

                      <TableCell>
                        <StatusCount
                          value={item.presentCount}
                          color={attendanceStatusColor(AttendanceStatus.PRESENT)}
                        />
                      </TableCell>

                      <TableCell>
                        <StatusCount
                          value={item.excusedCount}
                          color={attendanceStatusColor(AttendanceStatus.EXCUSED)}
                        />
                      </TableCell>
                      <TableCell>
                        <StatusCount value={item.absentCount} color={attendanceStatusColor(AttendanceStatus.ABSENT)} />
                      </TableCell>

                      <TableCell>
                        <Stack direction='row' spacing={1.5} alignItems='center'>
                          <LinearProgress
                            variant='determinate'
                            value={percentage}
                            sx={{
                              width: 170,
                              height: 7,
                              borderRadius: 10,
                            }}
                          />

                          <Typography variant='body2' sx={{ minWidth: 50 }}>
                            {percentage.toFixed(1)}%
                          </Typography>
                        </Stack>
                      </TableCell>

                      <TableCell align='right'>
                        <Tooltip title='Abrir sesión'>
                          <span>
                            <IconButton
                              size='small'
                              disabled={disabled}
                              aria-label={`Abrir sesión del ${formatDate(item.date)}`}
                              onClick={() => onSelectSession(item.idAttendanceSession)}
                            >
                              <VisibilityOutlinedIcon fontSize='small' />
                            </IconButton>
                          </span>
                        </Tooltip>

                        <Tooltip title='Más acciones'>
                          <span>
                            <IconButton
                              size='small'
                              disabled={disabled}
                              aria-label={`Más acciones de la sesión del ${formatDate(item.date)}`}
                              aria-haspopup='menu'
                              aria-expanded={menu?.sessionId === item.idAttendanceSession ? true : undefined}
                              onClick={(event) =>
                                setMenu({ anchor: event.currentTarget, sessionId: item.idAttendanceSession })
                              }
                            >
                              <MoreVertOutlinedIcon fontSize='small' />
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
        )}
      </Box>
      {!!sessions.length && !loading && (
        <PaginationTable
          count={sessions.length}
          page={table.page}
          rowsPerPage={table.rowsPerPage}
          onPageChange={table.handleChangePage}
          onRowsPerPageChange={table.handleChangeRowsPerPage}
        />
      )}
      <Menu anchorEl={menu?.anchor} open={!!menu} onClose={() => setMenu(null)}>
        <MenuItem
          disabled={disabled}
          onClick={() => {
            if (menu) onSelectSession(menu.sessionId);
            setMenu(null);
          }}
        >
          <VisibilityOutlinedIcon fontSize='small' sx={{ mr: 1 }} />
          Abrir para editar
        </MenuItem>
        {onEditDate && (
          <MenuItem
            disabled={disabled}
            onClick={() => {
              if (menu) onEditDate(menu.sessionId);
              setMenu(null);
            }}
          >
            Editar fecha
          </MenuItem>
        )}
        {onDeleteSession && (
          <MenuItem
            disabled={disabled}
            sx={{ color: 'error.main' }}
            onClick={() => {
              if (menu) onDeleteSession(menu.sessionId);
              setMenu(null);
            }}
          >
            Eliminar sesión
          </MenuItem>
        )}
      </Menu>
    </Card>
  );
}

interface StatusCountProps {
  value: number;
  color: string;
}

function StatusCount({ value, color }: StatusCountProps) {
  return (
    <Stack direction='row' spacing={1} alignItems='center'>
      <Box
        sx={{
          width: 9,
          height: 9,
          borderRadius: '50%',
          bgcolor: color,
        }}
      />

      <Typography variant='body2' color={color}>
        {value}
      </Typography>
    </Stack>
  );
}
