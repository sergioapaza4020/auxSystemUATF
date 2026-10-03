'use client';

import { useRef, useState } from 'react';

import { useRouter } from 'next/navigation';

import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  LinearProgress,
  Paper,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Typography,
} from '@mui/material';

import {
  downloadCareerStudentImportTemplate,
  importCareerStudents,
  previewCareerStudentImport,
} from '@/api/careers.service';
import { useAuth } from '@/hooks/useAuth';
import { useCareerStudentImportContext } from '@/hooks/careers/useCareerStudentImportContext';
import { hasPermission } from '@/utils/hasPermission';
import { formatImportFileSize, validateImportFile } from '@/utils/importFile';
import { getApiErrorMessage } from '@/utils/http/getApiErrorMessage';
import type { ICareer } from '@/interfaces/careers/career.interface';
import type {
  ICareerStudentImportPreview,
  ICareerStudentImportResult,
} from '@/interfaces/careers/career-student-import.interface';
import { CareerStudentImportReviewTable } from './CareerStudentImportReviewTable';
import { canConfirmCareerStudentImport } from './career-student-import';

function Destination({ career }: { career: ICareer }) {
  return (
    <Box>
      <Typography variant='h6'>{career.name}</Typography>
      {career.faculty && <Typography color='text.secondary'>{career.faculty.name}</Typography>}
    </Box>
  );
}

export function CareerStudentImportPage({ careerId }: { careerId: number }) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const validId = Number.isSafeInteger(careerId) && careerId > 0 && careerId <= 2147483647;
  const allowed = hasPermission(user, 'career.update');
  const canRead = hasPermission(user, 'career.get-all');
  const context = useCareerStudentImportContext(careerId, !authLoading && allowed && canRead && validId);
  const { career } = context;
  const backPath = '/dashboard/admin/careers';
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ICareerStudentImportPreview | null>(null);
  const [result, setResult] = useState<ICareerStudentImportResult | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const lock = useRef(false);
  const step = result ? 2 : preview ? 1 : 0;
  const canImport = !!file && canConfirmCareerStudentImport(preview);

  const run = async (action: () => Promise<void>) => {
    if (lock.current || !career || !allowed || !career.isActive) return;
    lock.current = true;
    setBusy(true);
    setError('');

    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error && !('isAxiosError' in cause) ? cause.message : getApiErrorMessage(cause));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  const reset = () => {
    if (lock.current) return;
    setFile(null);
    setPreview(null);
    setResult(null);
    setError('');
    setConfirm(false);
  };

  const download = () => {
    void run(async () => {
      const blob = await downloadCareerStudentImportTemplate(careerId);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');

      anchor.href = url;
      anchor.download = `plantilla-estudiantes-carrera-${careerId}.xlsx`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  };

  const review = () => {
    if (!file || lock.current) return;
    const validation = validateImportFile(file);

    if (validation) {
      setError(validation);

      return;
    }

    void run(async () => setPreview(await previewCareerStudentImport(file, careerId)));
  };

  const submit = () => {
    if (!canImport || !file || lock.current) return;
    setConfirm(false);
    void run(async () => setResult(await importCareerStudents(file, careerId)));
  };

  const back = (
    <Button disabled={busy} onClick={() => router.push(backPath)} startIcon={<i className='ri-arrow-left-line' />}>
      Volver a carreras
    </Button>
  );

  if (authLoading) return <LinearProgress aria-label='Cargando permisos' />;
  if (!validId) return <Alert severity='error'>La carrera destino no es válida.</Alert>;
  if (!allowed || !canRead)
    return (
      <Stack spacing={3}>
        <Box>{back}</Box>
        <Alert severity='warning'>No tienes permiso para importar estudiantes o consultar carreras.</Alert>
      </Stack>
    );
  if (context.loading) return <LinearProgress aria-label='Cargando carrera' />;
  if (context.error || !career)
    return (
      <Stack spacing={3}>
        <Box>{back}</Box>
        <Alert severity='error' action={<Button onClick={context.retry}>Reintentar</Button>}>
          {context.error || 'No se encontró la carrera destino.'}
        </Alert>
      </Stack>
    );
  if (!allowed || !career.isActive)
    return (
      <Stack spacing={3}>
        <Box>{back}</Box>
        <Alert severity='warning'>La carrera está inactiva y no permite asignar estudiantes.</Alert>
      </Stack>
    );

  return (
    <Stack spacing={3}>
      <Box>{back}</Box>
      <Box>
        <Typography variant='h4' component='h1'>
          Importar estudiantes
        </Typography>
        <Typography color='text.secondary'>
          Asigna múltiples estudiantes a esta carrera mediante un archivo Excel.
        </Typography>
      </Box>
      <Stepper activeStep={step} alternativeLabel>
        {['Configuración', 'Revisión', 'Resultado'].map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>
      <Paper variant='outlined' sx={{ p: { xs: 3, md: 5 }, borderRadius: 2 }}>
        <Stack spacing={3}>
          <Typography variant='h6'>{step === 1 ? 'Resumen de la importación' : 'Carrera destino'}</Typography>
          <Destination career={career} />
          {step === 1 && preview && file && (
            <>
              <Divider />
              <Box>
                <Typography color='text.secondary' variant='body2'>
                  Archivo
                </Typography>
                <Typography sx={{ overflowWrap: 'anywhere' }}>{file.name}</Typography>
                <Typography variant='body2' color='text.secondary'>
                  {formatImportFileSize(file.size)} · {preview.total} filas detectadas
                </Typography>
              </Box>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                {[
                  { label: 'Total', value: preview.total, color: 'primary.main' },
                  { label: 'Válidos', value: preview.valid, color: 'success.main' },
                  { label: 'Con errores', value: preview.invalid, color: 'error.main' },
                ].map((item) => (
                  <Paper variant='outlined' key={item.label} sx={{ flex: 1, p: 3 }}>
                    <Typography variant='h4' color={item.color}>
                      {item.value}
                    </Typography>
                    <Typography color='text.secondary'>{item.label}</Typography>
                  </Paper>
                ))}
              </Stack>
            </>
          )}
          {busy && (
            <Box role='status'>
              <Typography variant='body2' sx={{ mb: 1 }}>
                {step === 1 ? 'Asignando estudiantes…' : 'Procesando solicitud…'}
              </Typography>
              <LinearProgress />
            </Box>
          )}
          {error && (
            <Alert severity='error' sx={{ whiteSpace: 'pre-line' }}>
              {error}
            </Alert>
          )}
          {step === 0 && (
            <>
              <Alert severity='info'>
                Los estudiantes deben existir previamente en el sistema. La plantilla utiliza únicamente el RU para
                identificarlos. Solo se asignan estudiantes sin carrera. No se cambian carreras existentes.
              </Alert>
              <Box>
                <Button
                  variant='outlined'
                  disabled={busy}
                  onClick={download}
                  startIcon={<i className='ri-download-line' />}
                >
                  Descargar plantilla
                </Button>
              </Box>
              <Paper variant='outlined' sx={{ p: 3, borderStyle: 'dashed' }}>
                <Stack spacing={2} alignItems='flex-start'>
                  <Typography>Archivo Excel (.xlsx), máximo 5 MB</Typography>
                  <Button component='label' variant='outlined' disabled={busy}>
                    {file ? 'Cambiar archivo' : 'Seleccionar archivo'}
                    <input
                      type='file'
                      accept='.xlsx'
                      aria-label='Seleccionar archivo Excel de estudiantes'
                      disabled={busy}
                      style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)' }}
                      onChange={(event) => {
                        const selected = event.target.files?.[0];

                        event.target.value = '';
                        if (!selected || lock.current) return;
                        const validation = validateImportFile(selected);

                        setError(validation);
                        setFile(validation ? null : selected);
                      }}
                    />
                  </Button>
                  {file && (
                    <Typography variant='body2' sx={{ overflowWrap: 'anywhere' }}>
                      {file.name} · {formatImportFileSize(file.size)}
                    </Typography>
                  )}
                </Stack>
              </Paper>
              <Box sx={{ textAlign: 'right' }}>
                <Button variant='contained' disabled={!file || busy} onClick={review}>
                  Revisar archivo
                </Button>
              </Box>
            </>
          )}
          {step === 1 && preview && (
            <>
              <Alert severity={preview.invalid > 0 ? 'warning' : 'success'}>
                {preview.invalid > 0
                  ? `Se encontraron ${preview.invalid} filas con errores. Corrige el archivo y vuelve a revisarlo. No se asignará ningún estudiante mientras existan errores.`
                  : 'El archivo no contiene filas inválidas y está listo para asignar.'}
              </Alert>
              <CareerStudentImportReviewTable rows={preview.rows} busy={busy} />
              <Divider />
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent='space-between'>
                <Button variant='outlined' disabled={busy} onClick={reset}>
                  Elegir otro archivo
                </Button>
                <Button variant='contained' disabled={busy || !canImport} onClick={() => setConfirm(true)}>
                  Asignar {preview.valid} estudiantes
                </Button>
              </Stack>
            </>
          )}
          {step === 2 && result && (
            <Stack spacing={3} alignItems='center' textAlign='center'>
              <Box sx={{ color: 'success.main', fontSize: 48 }} aria-hidden='true'>
                ✓
              </Box>
              <Typography variant='h5' component='h2'>
                Asignación completada
              </Typography>
              <Typography>{result.imported} estudiantes fueron asignados correctamente.</Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <Button variant='outlined' onClick={reset}>
                  Importar otro archivo
                </Button>
                <Button variant='contained' onClick={() => router.push(backPath)}>
                  Volver a carreras
                </Button>
              </Stack>
            </Stack>
          )}
        </Stack>
      </Paper>
      <Dialog
        open={confirm}
        fullWidth
        maxWidth='sm'
        aria-labelledby='confirm-career-import-title'
        onClose={() => {
          if (!busy) setConfirm(false);
        }}
      >
        <DialogTitle id='confirm-career-import-title'>Confirmar asignación</DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <Destination career={career} />
            <DialogContentText>
              Se asignarán {preview?.valid ?? 0} estudiantes a esta carrera. No se reemplazarán carreras existentes.
            </DialogContentText>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={() => setConfirm(false)}>
            Cancelar
          </Button>
          <Button variant='contained' disabled={busy || !canImport} onClick={submit}>
            Confirmar asignación
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
