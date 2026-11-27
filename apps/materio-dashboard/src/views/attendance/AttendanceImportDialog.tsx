'use client';

import { useRef, useState } from 'react';

import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  MenuItem,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';

import {
  confirmAttendanceImport,
  downloadAttendanceTemplate,
  previewAttendanceImport,
} from '@/api/attendance-import.service';
import type {
  AttendanceImportChoice,
  AttendanceImportPreview,
  AttendanceImportSummary,
} from '@/interfaces/attendances/attendance-import.interface';
import { getApiErrorMessage } from '@/utils/http/getApiErrorMessage';
import { validateImportFile } from '@/utils/importFile';
import { PaginationTable, type HeadCell } from '@/components/table';
import { useDataTable } from '@/hooks/table/useDataTable';
import { AttendanceStatus } from '@/enums/attendanceStatus';
import { attendanceLocalTime } from '@/utils/attendance-geolocation';

const labels: Record<keyof AttendanceImportSummary, string> = {
  identified: 'Estudiantes identificados',
  dates: 'Fechas encontradas',
  reused: 'Sesiones reutilizadas',
  newSessions: 'Sesiones nuevas',
  present: 'Presentes',
  absent: 'Ausentes',
  excused: 'Permisos',
  empty: 'Vacíos convertidos en ausencias',
  created: 'Registros nuevos',
  updated: 'Registros actualizados',
  skipped: 'Registros existentes omitidos',
  errors: 'Errores',
  warnings: 'Advertencias',
};

const statuses: Record<AttendanceStatus, string> = {
  PRESENT: 'Presente',
  ABSENT: 'Ausente',
  EXCUSED: 'Permiso',
};

const actions = { create: 'Crear', update: 'Actualizar', skip: 'Omitir', blocked: 'Conflicto' };

const sessionModes: Record<string, string> = {
  MANUAL: 'Manual',
  QR: 'QR',
  GEOLOCATION: 'Geolocalizada',
  GEOLOCATION_QR: 'QR geolocalizado',
};

const sessionStates: Record<string, string> = {
  MANUAL: 'Editable',
  DRAFT: 'Borrador',
  SCHEDULED: 'Programada',
  OPEN: 'Abierta',
  CLOSED: 'Cerrada',
  CANCELLED: 'Cancelada',
  EXPIRED: 'Vencida',
};

const displayDate = (date: string | null) => (date ? date.split('-').reverse().join('/') : 'Fecha inválida');

type Cell = AttendanceImportPreview['cells'][number];

const columns = [{ id: 'row', label: 'Fila', sortable: true }] as const satisfies readonly HeadCell<Cell>[];

export function AttendanceImportSessionTarget({
  column,
  value,
  disabled,
  onChange,
}: {
  column: AttendanceImportPreview['columns'][number];
  value?: AttendanceImportChoice['sessionId'];
  disabled: boolean;
  onChange: (id: number) => void;
}) {
  const selected = column.candidates.find((session) => session.id === (value ?? column.selected?.id));

  const describe = (session: (typeof column.candidates)[number]) =>
    `Sesión ${session.id} · ${sessionModes[session.mode] ?? session.mode} · ${sessionStates[session.state] ?? session.state}${session.startsAt ? ` · ${attendanceLocalTime(session.startsAt).replace('T', ' ')}${session.endsAt ? ` — ${attendanceLocalTime(session.endsAt).replace('T', ' ')}` : ''} (America/La_Paz)` : ''}${!session.editable ? ' · Protegida' : ''}`;

  const multiple = column.candidates.length > 1 && column.candidates.some((session) => session.editable);

  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant='body2'>
        {column.column} · {displayDate(column.date)}
      </Typography>
      {multiple ? (
        <TextField
          fullWidth
          select
          size='small'
          disabled={disabled}
          label={`Sesión de destino · ${displayDate(column.date)}`}
          value={value ?? column.selected?.id ?? 'unresolved'}
          onChange={(event) => onChange(Number(event.target.value))}
          sx={{ mt: 1 }}
        >
          <MenuItem value='unresolved' disabled>
            Selecciona la sesión de destino
          </MenuItem>
          {column.candidates.map((session) => (
            <MenuItem key={session.id} value={session.id} disabled={!session.editable}>
              {describe(session)}
            </MenuItem>
          ))}
        </TextField>
      ) : column.candidates.length ? (
        column.candidates.map((session) => (
          <Typography key={session.id} variant='body2' sx={{ overflowWrap: 'anywhere' }}>
            {describe(session)}
          </Typography>
        ))
      ) : (
        <Typography variant='body2'>
          {column.create ? 'Se creará una sesión manual' : 'No se puede crear una sesión para esta fecha'}
        </Typography>
      )}
      {column.candidates.length && !column.candidates.some((session) => session.editable) ? (
        <Alert severity='error'>La sesión está protegida. No se creará otra sesión para eludir esta restricción.</Alert>
      ) : null}
      <Typography variant='body2' color='text.secondary' sx={{ overflowWrap: 'anywhere' }}>
        Tema:{' '}
        {selected
          ? selected.topic?.trim() || 'Sin tema'
          : column.candidates.length === 1
            ? column.candidates[0].topic?.trim() || 'Sin tema'
            : column.candidates.length
              ? 'Selecciona una sesión para consultar su tema'
              : 'Sin tema'}
      </Typography>
    </Box>
  );
}

export function AttendanceImportDialog({
  enrollmentId,
  onClose,
  onImported,
}: {
  enrollmentId: number;
  onClose: () => void;
  onImported: () => void;
}) {
  const [file, setFile] = useState<File>();
  const [preview, setPreview] = useState<AttendanceImportPreview>();
  const [result, setResult] = useState<AttendanceImportSummary>();
  const [choices, setChoices] = useState<Record<string, AttendanceImportChoice['sessionId']>>({});
  const [updateExisting, setUpdateExisting] = useState(false);
  const [dirty, setDirty] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  const table = useDataTable<Cell, typeof columns>(preview?.cells ?? [], 'row', 25, { preserveOrder: true });
  const operationId = dirty ? null : preview?.operationId;
  const totals = result ?? (!dirty ? preview?.summary : undefined);

  async function run(work: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');

    try {
      await work();
    } catch (failure) {
      setError(getApiErrorMessage(failure));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return (
    <Dialog
      fullWidth
      maxWidth='md'
      open
      onClose={() => {
        if (!lock.current) onClose();
      }}
    >
      <DialogTitle>Importar asistencia desde Excel</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ minWidth: 0 }}>
          <Stepper alternativeLabel activeStep={result ? 2 : preview ? 1 : 0}>
            {['Archivo', 'Revisión', 'Resultado'].map((step) => (
              <Step key={step}>
                <StepLabel>{step}</StepLabel>
              </Step>
            ))}
          </Stepper>
          {busy && <LinearProgress />}
          {error && <Alert severity='error'>{error}</Alert>}
          {result ? (
            <Alert severity='success'>Importación completada</Alert>
          ) : (
            <>
              <Typography variant='body2'>
                Escribe RU en A1 y las fechas en formato dd/mm/aaaa desde B1. Completa los RU y estados desde la fila 2.
                Usa 1 para presente, 0 para ausente y 2 para permiso.
              </Typography>
              <Alert severity='warning'>
                Las celdas vacías de esta plantilla se registrarán como ausencias para los registros nuevos. Si
                seleccionaste actualizar registros existentes, también podrían sustituir asistencias anteriores.
              </Alert>
              <Stack spacing={1} direction={{ xs: 'column', sm: 'row' }}>
                <Button disabled={busy} onClick={() => run(() => downloadAttendanceTemplate(enrollmentId))}>
                  Descargar plantilla de asistencia
                </Button>
                <Button component='label' disabled={busy}>
                  Seleccionar Excel
                  <input
                    hidden
                    type='file'
                    accept='.xlsx'
                    onChange={(event) => {
                      const selected = event.target.files?.[0];

                      if (!selected) return;

                      const fileError = validateImportFile(selected);

                      event.target.value = '';
                      setFile(fileError ? undefined : selected);
                      setError(fileError);
                      setPreview(undefined);
                      setChoices({});
                      setDirty(true);
                      setUpdateExisting(false);
                    }}
                  />
                </Button>
                <Button
                  variant='outlined'
                  disabled={!file || busy}
                  onClick={() =>
                    file &&
                    run(async () => {
                      setDirty(true);
                      setPreview(
                        await previewAttendanceImport(
                          enrollmentId,
                          file,
                          Object.entries(choices).map(([column, sessionId]) => ({ column, sessionId })),
                          updateExisting,
                        ),
                      );
                      table.handleChangePage(null, 0);
                      setDirty(false);
                    })
                  }
                >
                  Validar y ver vista previa
                </Button>
              </Stack>
              {file && (
                <Typography variant='body2' sx={{ overflowWrap: 'anywhere' }}>
                  {file.name}
                </Typography>
              )}
              {preview && (
                <>
                  <TextField
                    select
                    label='Registros existentes'
                    disabled={busy}
                    value={updateExisting ? 'update' : 'skip'}
                    onChange={(event) => {
                      setUpdateExisting(event.target.value === 'update');
                      setDirty(true);
                    }}
                  >
                    <MenuItem value='skip'>Omitir registros existentes</MenuItem>
                    <MenuItem value='update'>Actualizar registros existentes</MenuItem>
                  </TextField>
                  {preview.columns.map((column) => (
                    <AttendanceImportSessionTarget
                      key={column.column}
                      column={column}
                      disabled={busy}
                      value={choices[column.column]}
                      onChange={(sessionId) => {
                        setChoices((previous) => ({
                          ...previous,
                          [column.column]: sessionId,
                        }));
                        setDirty(true);
                      }}
                    />
                  ))}
                  {dirty ? (
                    <Alert severity='info'>Vuelve a validar para aplicar tus decisiones.</Alert>
                  ) : (
                    <>
                      {preview.warnings.map((warning) => (
                        <Alert severity='warning' key={warning}>
                          {warning}
                        </Alert>
                      ))}
                      {preview.errors.length > 0 && (
                        <Box sx={{ maxHeight: 230, overflow: 'auto' }}>
                          {preview.errors.map((item, index) => (
                            <Typography key={index} variant='body2' color='error'>
                              {item.column}
                              {item.row}
                              {item.ru && ` · RU ${item.ru}`} · {item.message}
                            </Typography>
                          ))}
                        </Box>
                      )}
                      {preview.cells.length > 0 && (
                        <Box sx={{ minWidth: 0 }}>
                          <Box sx={{ overflow: 'auto', maxHeight: 320 }}>
                            <Table size='small' stickyHeader aria-label='Vista previa de asistencia'>
                              <TableHead>
                                <TableRow>
                                  {[
                                    'Celda',
                                    'RU',
                                    'Fecha',
                                    'Sesión',
                                    'Estado actual',
                                    'Estado importado',
                                    'Acción',
                                  ].map((label) => (
                                    <TableCell key={label}>{label}</TableCell>
                                  ))}
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {table.visibleRows.map((cell) => (
                                  <TableRow key={`${cell.column}${cell.row}`}>
                                    <TableCell>
                                      {cell.column}
                                      {cell.row}
                                    </TableCell>
                                    <TableCell>{cell.ru}</TableCell>
                                    <TableCell>{displayDate(cell.date)}</TableCell>
                                    <TableCell>{cell.sessionId ?? '—'}</TableCell>
                                    <TableCell>{cell.previous ? statuses[cell.previous] : '—'}</TableCell>
                                    <TableCell>
                                      <Chip
                                        size='small'
                                        label={`${statuses[cell.status]}${cell.empty ? ' (vacío)' : ''}`}
                                        color={
                                          cell.status === AttendanceStatus.PRESENT
                                            ? 'success'
                                            : cell.status === AttendanceStatus.EXCUSED
                                              ? 'warning'
                                              : 'default'
                                        }
                                      />
                                    </TableCell>
                                    <TableCell>{actions[cell.action]}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </Box>
                          <PaginationTable
                            count={preview.cells.length}
                            page={table.page}
                            rowsPerPage={table.rowsPerPage}
                            onPageChange={table.handleChangePage}
                            onRowsPerPageChange={table.handleChangeRowsPerPage}
                          />
                        </Box>
                      )}
                    </>
                  )}
                </>
              )}
            </>
          )}
          {totals && (
            <Box
              component='dl'
              sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr auto', sm: 'repeat(2, 1fr auto)' }, gap: 1, m: 0 }}
            >
              {Object.entries(totals).map(([key, value]) => (
                <Box key={key} sx={{ display: 'contents' }}>
                  <Typography variant='body2' component='dt'>
                    {labels[key as keyof AttendanceImportSummary]}
                  </Typography>
                  <Typography variant='body2' component='dd' sx={{ m: 0 }}>
                    {value}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button disabled={busy} onClick={onClose}>
          {result ? 'Cerrar' : 'Cancelar'}
        </Button>
        {!result && (
          <Button
            variant='contained'
            disabled={busy || !operationId}
            onClick={() =>
              operationId &&
              run(async () => {
                setResult(await confirmAttendanceImport(enrollmentId, operationId));
                onImported();
              })
            }
          >
            Confirmar importación
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
