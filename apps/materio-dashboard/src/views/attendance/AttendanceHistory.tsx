import { useState } from 'react';

import {
  Box,
  Button,
  Chip,
  Menu,
  MenuItem,
  Card,
  IconButton,
  LinearProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';

import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import MoreVertOutlinedIcon from '@mui/icons-material/MoreVertOutlined';

import { DataTableContainer, PaginationTable, TableToolbar } from '@/components/table';
import { PageLoading } from '@/components/feedback/PageLoading';

import { attendanceStatusColor } from '@/utils/attendance-status';
import { AttendanceStatus } from '@/enums/attendanceStatus';

import type { PaginationMeta } from '@/interfaces/apiResponse';
import type { IAttendanceLifecycle } from '@/interfaces/attendances/attendance.interface';
import { canDeleteAttendanceSession } from '@/utils/attendance-geolocation';
import { AttendanceSessionBadge } from './AttendanceSessionBadge';

interface AttendanceSession extends IAttendanceLifecycle {
  idAttendanceSession: number;
  date: string;
  presentCount: number;
  excusedCount: number;
  absentCount: number;
  totalStudents: number;
  percentage: number;
}

interface AttendanceHistoryProps {
  sessions: AttendanceSession[];
  meta: PaginationMeta;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
  loading: boolean;

  selectedSessionId: number | null;

  onSelectSession: (idSession: number) => void;
  onCreateSession?: () => void;
  disabled?: boolean;
  onEditDate?: (id: number, date: string) => void;
  onDeleteSession?: (id: number) => void;
  onRefresh?: () => void;
  refreshDisabled?: boolean;
}

export function AttendanceHistory({
  sessions,
  meta,
  onPageChange,
  onLimitChange,
  loading,
  selectedSessionId,
  onSelectSession,
  onCreateSession,
  disabled = false,
  onEditDate,
  onDeleteSession,
  onRefresh,
  refreshDisabled = false,
}: AttendanceHistoryProps) {
  const [menu, setMenu] = useState<{ anchor: HTMLElement; sessionId: number; date: string } | null>(null);
  const menuSession = sessions.find((item) => item.idAttendanceSession === menu?.sessionId);

  const formatDate = (date: string) => {
    const [year, month, day] = date.slice(0, 10).split('-');

    return `${day}/${month}/${year}`;
  };

  return (
    <Card>
      <TableToolbar
        onRefresh={onRefresh}
        refreshDisabled={loading || disabled || refreshDisabled}
        refreshReason={refreshDisabled ? 'Guarda o cancela los cambios pendientes antes de actualizar.' : undefined}
      >
        <Box>
          <Typography variant='h6' fontWeight={700}>
            Historial de asistencia
          </Typography>

          <Typography variant='body2' color='text.secondary'>
            Abre una sesión para revisar o ajustar su asistencia.
          </Typography>
        </Box>
        <TextField
          size='small'
          label='Buscar sesión de asistencia'
          disabled
          helperText='El historial paginado no dispone de búsqueda global.'
        />
      </TableToolbar>

      <Box sx={{ p: 2 }}>
        {loading && <LinearProgress />}
        {loading && !sessions.length ? (
          <PageLoading minHeight={0} sx={{ p: 4 }} />
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
          <DataTableContainer>
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
                {sessions.map((item) => {
                  const percentage = item.percentage;

                  const selected = selectedSessionId === item.idAttendanceSession;

                  return (
                    <TableRow key={item.idAttendanceSession} hover selected={selected}>
                      <TableCell>
                        <Typography variant='body2' fontWeight={selected ? 600 : 400}>
                          {formatDate(item.date)}
                        </Typography>
                        {selected && <Chip size='small' variant='outlined' label='En edición' sx={{ mt: 0.5 }} />}
                        <Typography variant='caption'>Sesión #{item.idAttendanceSession}</Typography>
                        <AttendanceSessionBadge session={item} />
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
                        {(item.mode === 'GEOLOCATION' || item.mode === 'QR' || item.mode === 'GEOLOCATION_QR') &&
                        item.isComputable === false ? (
                          <Typography variant='body2'>
                            {item.pendingCount ?? 0} pendientes
                            {item.mode === 'GEOLOCATION_QR' ? ` · ${item.absentCount} ausentes explícitos` : ''}
                          </Typography>
                        ) : (
                          <StatusCount
                            value={item.absentCount}
                            color={attendanceStatusColor(AttendanceStatus.ABSENT)}
                          />
                        )}
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
                            {(item.mode === 'GEOLOCATION' || item.mode === 'QR' || item.mode === 'GEOLOCATION_QR') &&
                            item.isComputable === false
                              ? 'Sin consolidar'
                              : `${percentage.toFixed(1)}%`}
                          </Typography>
                        </Stack>
                      </TableCell>

                      <TableCell align='right' sx={{ '& > span + span': { ml: 0.75 } }}>
                        <Tooltip title='Abrir sesión'>
                          <span>
                            <IconButton
                              size='small'
                              color='info'
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
                              color='secondary'
                              disabled={disabled}
                              aria-label={`Más acciones de la sesión del ${formatDate(item.date)}`}
                              aria-haspopup='menu'
                              aria-expanded={menu?.sessionId === item.idAttendanceSession ? true : undefined}
                              onClick={(event) =>
                                setMenu({
                                  anchor: event.currentTarget,
                                  sessionId: item.idAttendanceSession,
                                  date: item.date,
                                })
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
          </DataTableContainer>
        )}
      </Box>
      {!!meta.total && (
        <PaginationTable
          count={meta.total}
          page={meta.page - 1}
          rowsPerPage={meta.limit}
          onPageChange={(_, page) => onPageChange(page + 1)}
          onRowsPerPageChange={(event) => onLimitChange(Number(event.target.value))}
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
        {onEditDate &&
          menuSession?.mode !== 'GEOLOCATION' &&
          menuSession?.mode !== 'QR' &&
          menuSession?.mode !== 'GEOLOCATION_QR' && (
            <MenuItem
              sx={{ color: 'warning.main' }}
              disabled={disabled}
              onClick={() => {
                if (menu) onEditDate(menu.sessionId, menu.date.slice(0, 10));
                setMenu(null);
              }}
            >
              Editar fecha
            </MenuItem>
          )}
        {onDeleteSession && menuSession && canDeleteAttendanceSession(menuSession) && (
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
