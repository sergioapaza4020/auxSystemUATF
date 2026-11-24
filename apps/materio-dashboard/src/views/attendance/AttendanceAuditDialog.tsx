'use client';

import { useEffect, useRef, useState } from 'react';

import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';

import { DataTableContainer, TableToolbar } from '@/components/table';
import { PageLoading } from '@/components/feedback/PageLoading';

import { getAttendanceAudit } from '@/api/attendances.service';
import type { IAttendanceAuditEvent } from '@/interfaces/attendances/attendance.interface';
import type { PaginationMeta } from '@/interfaces/apiResponse';
import { useDataTable } from '@/hooks/table/useDataTable';
import { PaginationTable, type HeadCell } from '@/components/table';
import { useSnackbar } from '@/hooks/useSnackbar';
import { attendanceMethodLabels, combinedAttendanceError } from '@/utils/attendance-combined';
import { attendanceLocalTime } from '@/utils/attendance-geolocation';

const columns = [
  { id: 'idAttendanceAuditEvent', label: 'Evento', sortable: true },
] as const satisfies readonly HeadCell<IAttendanceAuditEvent>[];

export function AttendanceAuditDialog({ idSession, onClose }: { idSession: number; onClose: () => void }) {
  const [query, setQuery] = useState({ page: 1, limit: 10 });
  const [events, setEvents] = useState<IAttendanceAuditEvent[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const snackbar = useSnackbar();
  const notification = useRef(snackbar);

  notification.current = snackbar;

  const table = useDataTable<IAttendanceAuditEvent, typeof columns>(events, 'idAttendanceAuditEvent', query.limit, {
    preserveOrder: true,
    remote: {
      ...query,
      changeQuery: (patch) => setQuery((current) => ({ ...current, ...patch, page: patch.page ?? 1 })),
    },
  });

  useEffect(() => {
    const controller = new AbortController();

    setLoading(true);
    setError('');
    setEvents([]);
    void getAttendanceAudit(idSession, query, controller.signal)
      .then((response) => {
        if (controller.signal.aborted) return;
        setEvents(response.data);
        setMeta(response.meta);
      })
      .catch((failure) => {
        if (controller.signal.aborted) return;
        const message = combinedAttendanceError(failure);

        setError(message);
        notification.current.error(message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [idSession, query, revision]);

  return (
    <Dialog open fullWidth maxWidth='lg' onClose={onClose} aria-labelledby='attendance-audit-title'>
      <DialogTitle id='attendance-audit-title'>Historial de cambios · Sesión #{idSession}</DialogTitle>
      <DialogContent dividers>
        <TableToolbar
          compact
          onRefresh={() => setRevision((value) => value + 1)}
          refreshDisabled={loading}
          description='Historial paginado de solo lectura. La API no ofrece búsqueda o filtros adicionales.'
        />
        <Typography variant='caption'>
          Solo lectura. Horario America/La_Paz. Se muestran únicamente las referencias identificativas autorizadas por
          el servidor.
        </Typography>
        {error && <Alert severity='error'>{error}</Alert>}
        {loading ? (
          <PageLoading />
        ) : (
          !error && (
            <>
              <DataTableContainer>
                <Table size='small' aria-label='Eventos de asistencia'>
                  <TableHead>
                    <TableRow>
                      {[
                        'Fecha / actor',
                        'Matrícula / operación',
                        'Estado anterior → nuevo',
                        'Método anterior → nuevo',
                        'Motivo anterior',
                        'Motivo nuevo',
                      ].map((label) => (
                        <TableCell key={label}>{label}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {table.visibleRows.map((event) => (
                      <TableRow key={event.idAttendanceAuditEvent}>
                        <TableCell>
                          {attendanceLocalTime(event.occurredAt).replace('T', ' ')}
                          <br />
                          Usuario #{event.idActor} · Evento #{event.idAttendanceAuditEvent}
                        </TableCell>
                        <TableCell>
                          Matrícula #{event.idEnrollment}
                          <br />
                          {event.operation === 'CREATE' ? 'Registro' : 'Corrección'} · {event.sessionStateAtOperation}
                        </TableCell>
                        <TableCell>
                          {event.previousStatus ?? 'Sin marca'} → {event.newStatus}
                        </TableCell>
                        <TableCell>
                          {event.previousRegistrationMethod
                            ? attendanceMethodLabels[event.previousRegistrationMethod]
                            : 'Sin marca'}{' '}
                          → {attendanceMethodLabels[event.newRegistrationMethod]}
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                          {event.previousObservation ?? '—'}
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                          {event.newObservation ?? '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                    {!events.length && (
                      <TableRow>
                        <TableCell colSpan={6}>No hay eventos registrados.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </DataTableContainer>
              <PaginationTable
                count={meta.total}
                page={query.page - 1}
                rowsPerPage={query.limit}
                onPageChange={(_, page) => setQuery((current) => ({ ...current, page: page + 1 }))}
                onRowsPerPageChange={(event) => setQuery({ page: 1, limit: Number(event.target.value) })}
              />
            </>
          )
        )}
      </DialogContent>
      <DialogActions>
        {error && <Button onClick={() => setRevision((value) => value + 1)}>Reintentar</Button>}
        <Button onClick={onClose}>Cerrar historial</Button>
      </DialogActions>
    </Dialog>
  );
}
