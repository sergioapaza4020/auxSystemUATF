'use client';

import { useRef, useState } from 'react';

import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
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

import { confirmGradeImport, downloadGradeTemplate, previewGradeImport } from '@/api/grade-import.service';
import { PaginationTable, type HeadCell } from '@/components/table';
import { useDataTable } from '@/hooks/table/useDataTable';
import type {
  GradeImportChoice,
  GradeImportPreview,
  GradeImportSummary,
} from '@/interfaces/grades/grade-import.interface';
import { getApiErrorMessage } from '@/utils/http/getApiErrorMessage';
import { formatImportFileSize, validateImportFile } from '@/utils/importFile';

const labels: Record<keyof GradeImportSummary, string> = {
  identified: 'Estudiantes identificados',
  existingActivities: 'Actividades reutilizadas',
  newActivities: 'Actividades nuevas',
  similar: 'Columnas con sugerencias',
  created: 'Notas nuevas',
  updated: 'Notas actualizadas',
  skipped: 'Notas existentes omitidas',
  empty: 'Celdas vacías ignoradas',
  errors: 'Errores',
  warnings: 'Advertencias',
};

type GradeConflict = GradeImportPreview['conflicts'][number];

const conflictColumns = [
  { id: 'row', label: 'Fila', sortable: true },
] as const satisfies readonly HeadCell<GradeConflict>[];

export function GradeImportDialog({
  enrollmentId,
  onClose,
  onImported,
}: {
  enrollmentId: number;
  onClose: () => void;
  onImported: () => void;
}) {
  const [file, setFile] = useState<File>();
  const [preview, setPreview] = useState<GradeImportPreview>();
  const [choices, setChoices] = useState<Record<string, GradeImportChoice>>({});
  const [updateExisting, setUpdateExisting] = useState(false);
  const [dirty, setDirty] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<GradeImportSummary>();
  const lock = useRef(false);

  const conflictTable = useDataTable<GradeConflict, typeof conflictColumns>(preview?.conflicts ?? [], 'row', 25, {
    preserveOrder: true,
  });

  async function run(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');

    try {
      await action();
    } catch (failure) {
      setError(getApiErrorMessage(failure));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  function select(choice: GradeImportChoice) {
    setChoices((current) => ({ ...current, [choice.column]: choice }));
    setDirty(true);
  }

  const operationId = !dirty ? preview?.operationId : null;

  return (
    <Dialog
      fullWidth
      maxWidth='md'
      open
      onClose={() => {
        if (!lock.current) onClose();
      }}
    >
      <DialogTitle>Importar calificaciones desde Excel</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Stepper activeStep={result ? 2 : preview ? 1 : 0} alternativeLabel>
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
                Escribe RU en A1, los nombres de las actividades desde B1 y sus fechas límite en la segunda fila
                (dd/mm/aaaa). A partir de la tercera fila, registra las notas. Las celdas vacías conservan las notas
                existentes.
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                <Button disabled={busy} onClick={() => run(() => downloadGradeTemplate(enrollmentId))}>
                  Descargar plantilla de calificaciones
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
                      const validationError = validateImportFile(selected);

                      event.target.value = '';
                      setFile(validationError ? undefined : selected);
                      setPreview(undefined);
                      setChoices({});
                      setUpdateExisting(false);
                      setDirty(true);
                      setError(validationError);
                    }}
                  />
                </Button>
                <Button
                  disabled={!file || busy}
                  variant='outlined'
                  onClick={() =>
                    file &&
                    run(async () => {
                      setDirty(true);
                      setPreview(await previewGradeImport(enrollmentId, file, Object.values(choices), updateExisting));
                      setDirty(false);
                    })
                  }
                >
                  Validar y ver vista previa
                </Button>
              </Stack>
              {file && (
                <Typography variant='body2' sx={{ overflowWrap: 'anywhere' }}>
                  {file.name} · {formatImportFileSize(file.size)}
                </Typography>
              )}
              {preview && (
                <>
                  <TextField
                    select
                    label='Notas existentes'
                    value={updateExisting ? 'update' : 'skip'}
                    disabled={busy}
                    onChange={(event) => {
                      setUpdateExisting(event.target.value === 'update');
                      setDirty(true);
                    }}
                  >
                    <MenuItem value='skip'>Omitir calificaciones existentes</MenuItem>
                    <MenuItem value='update' disabled={!preview.canUpdate}>
                      Actualizar calificaciones existentes
                    </MenuItem>
                  </TextField>
                  {!preview.canCreate && (
                    <Alert severity='info'>
                      Tu cuenta permite vincular actividades existentes. Crear actividades requiere un permiso
                      adicional.
                    </Alert>
                  )}
                  {preview.columns.map((column) => {
                    const choice = choices[column.column];

                    const activity =
                      choice?.detailId === undefined
                        ? preview.choices.find((item) => item.id === (choice?.activityId ?? column.automaticActivityId))
                        : undefined;

                    const value = choice?.detailId
                      ? `new:${choice.detailId}`
                      : choice?.activityId !== undefined && activity
                        ? `activity:${activity.id}`
                        : '';

                    const dateMismatch = activity && column.dueDate && activity.dueDate !== column.dueDate;

                    return (
                      <Stack key={column.column} spacing={1} sx={{ borderBottom: 1, borderColor: 'divider', pb: 2 }}>
                        <Typography fontWeight={600}>
                          {column.column} · {column.name || 'Sin nombre'} · {column.dueDate ?? 'Fecha inválida'}
                        </Typography>
                        <TextField
                          select
                          size='small'
                          label='Resolver actividad'
                          value={value}
                          disabled={busy}
                          onChange={(event) => {
                            const [kind, id] = event.target.value.split(':');

                            select({
                              column: column.column,
                              ...(kind === 'activity'
                                ? { activityId: Number(id) }
                                : kind === 'new'
                                  ? { detailId: Number(id) }
                                  : {}),
                            });
                          }}
                        >
                          <MenuItem value=''>
                            {column.automaticActivityId
                              ? 'Usar coincidencia exacta automática'
                              : 'Selecciona una actividad o un criterio'}
                          </MenuItem>
                          {preview.choices.map((item) => (
                            <MenuItem key={item.id} value={`activity:${item.id}`} sx={{ whiteSpace: 'normal' }}>
                              {item.name} · {preview.criteria.find((criterion) => criterion.id === item.detailId)?.name}{' '}
                              · {item.dueDate}
                            </MenuItem>
                          ))}
                          {preview.canCreate &&
                            preview.criteria.map((item) => (
                              <MenuItem key={`new:${item.id}`} value={`new:${item.id}`}>
                                Crear nueva actividad · {item.name}
                              </MenuItem>
                            ))}
                        </TextField>
                        <Typography variant='body2' color='text.secondary'>
                          {choice?.detailId
                            ? 'Nueva actividad · puntaje máximo 100'
                            : activity
                              ? `${column.suggestions.some((item) => item.id === activity.id && item.exact) ? 'Coincidencia exacta' : 'Vinculación manual'} · ${activity.name}`
                              : column.suggestions.length
                                ? 'Coincidencias por resolver'
                                : 'Actividad por configurar'}
                        </Typography>
                        {column.suggestions.map((item) => (
                          <Typography key={item.id} variant='body2'>
                            {item.reason} · {item.name} ·{' '}
                            {preview.criteria.find((criterion) => criterion.id === item.detailId)?.name} ·{' '}
                            {item.dueDate}
                          </Typography>
                        ))}
                        {dateMismatch && (
                          <FormControlLabel
                            label={`Conservar fecha límite vigente (${activity.dueDate})`}
                            control={
                              <Checkbox
                                checked={choice?.acceptDate ?? false}
                                disabled={busy}
                                onChange={(event) =>
                                  select({
                                    column: column.column,
                                    activityId: activity.id,
                                    acceptDate: event.target.checked,
                                  })
                                }
                              />
                            }
                          />
                        )}
                      </Stack>
                    );
                  })}
                  {dirty && (
                    <Alert severity='info'>Vuelve a validar para aplicar las decisiones y calcular el resumen.</Alert>
                  )}
                  {!dirty && (
                    <>
                      {preview.warnings.map((warning) => (
                        <Alert key={warning} severity='warning'>
                          {warning}
                        </Alert>
                      ))}
                      {preview.errors.length > 0 && (
                        <Box sx={{ maxHeight: 280, overflow: 'auto' }}>
                          {preview.errors.map((item, index) => (
                            <Typography key={index} variant='body2' color='error'>
                              {item.column}
                              {item.row} {item.ru && `· RU ${item.ru}`} {item.activity && `· ${item.activity}`} ·{' '}
                              {item.message}
                            </Typography>
                          ))}
                        </Box>
                      )}
                      {preview.conflicts.length > 0 && (
                        <Box sx={{ minWidth: 0 }}>
                          <Box sx={{ maxHeight: 280, overflow: 'auto' }}>
                            <Table size='small' stickyHeader aria-label='Calificaciones existentes'>
                              <TableHead>
                                <TableRow>
                                  <TableCell>Celda</TableCell>
                                  <TableCell>RU</TableCell>
                                  <TableCell>Actividad</TableCell>
                                  <TableCell>Nota actual</TableCell>
                                  <TableCell>Nota importada</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {conflictTable.visibleRows.map((item) => (
                                  <TableRow key={`${item.column}${item.row}`}>
                                    <TableCell>
                                      {item.column}
                                      {item.row}
                                    </TableCell>
                                    <TableCell>{item.ru}</TableCell>
                                    <TableCell>{item.activity}</TableCell>
                                    <TableCell>{item.previous}</TableCell>
                                    <TableCell>{item.score}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </Box>
                          <PaginationTable
                            count={preview.conflicts.length}
                            page={conflictTable.page}
                            rowsPerPage={conflictTable.rowsPerPage}
                            rowsPerPageOptions={[10, 25, 50]}
                            onPageChange={conflictTable.handleChangePage}
                            onRowsPerPageChange={conflictTable.handleChangeRowsPerPage}
                          />
                        </Box>
                      )}
                    </>
                  )}
                </>
              )}
            </>
          )}
          {(result ?? (!dirty && preview?.summary)) && (
            <Box
              component='dl'
              sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr auto', sm: 'repeat(2, 1fr auto)' }, gap: 1, m: 0 }}
            >
              {Object.entries(result ?? preview?.summary ?? {}).map(([key, count]) => (
                <Box key={key} sx={{ display: 'contents' }}>
                  <Typography component='dt' variant='body2'>
                    {labels[key as keyof GradeImportSummary]}
                  </Typography>
                  <Typography component='dd' variant='body2' sx={{ m: 0 }}>
                    {count}
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
            disabled={!operationId || busy}
            onClick={() =>
              operationId &&
              run(async () => {
                try {
                  setResult(await confirmGradeImport(enrollmentId, operationId));
                  onImported();
                } catch (failure) {
                  setDirty(true);
                  throw failure;
                }
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
