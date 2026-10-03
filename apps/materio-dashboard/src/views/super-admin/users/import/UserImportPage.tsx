'use client';

import { useEffect, useRef, useState } from 'react';

import { useRouter } from 'next/navigation';

import { isAxiosError } from 'axios';

import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  LinearProgress,
  MenuItem,
  Paper,
  Stack,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
} from '@mui/material';

import {
  confirmUserImport,
  downloadUserImportTemplate,
  getUserImportStatus,
  previewUserImport,
} from '@/api/users.service';
import { useUserImportProgress } from '@/hooks/users/useUserImportProgress';
import { isImportTerminal } from '@/hooks/users/userImportPolling';
import { useAuth } from '@/hooks/useAuth';
import { hasPermission } from '@/utils/hasPermission';
import { getApiErrorMessage } from '@/utils/http/getApiErrorMessage';
import type { IUserImportPreview } from '@/interfaces/users/user-import.interface';
import { ImportReviewTable } from './ImportReviewTable';
import { importRoles, requiresRu, validateImportFile, type ImportRole } from './user-import';

const usersPath = '/dashboard/super-admin/users';

const fileSize = (size: number) =>
  size < 1024 * 1024 ? `${(size / 1024).toFixed(1)} KB` : `${(size / (1024 * 1024)).toFixed(2)} MB`;

export function UserImportPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [role, setRole] = useState<ImportRole>('STUDENT');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<IUserImportPreview | null>(null);
  const [operationId, setOperationId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(false);
  const lock = useRef(false);
  const allowed = hasPermission(user, 'user.create');
  const { execution, error: progressError } = useUserImportProgress(operationId, allowed && !loading);
  const terminal = execution ? isImportTerminal(execution.status) : false;

  useEffect(() => {
    const id = new URL(window.location.href).searchParams.get('operationId');

    if (id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) setOperationId(id);
  }, []);

  const rememberOperation = (id: string | null) => {
    const url = new URL(window.location.href);

    if (id) url.searchParams.set('operationId', id);
    else url.searchParams.delete('operationId');
    window.history.replaceState(null, '', url);
    setOperationId(id);
  };

  const roleLabel = importRoles.find((option) => option.value === role)?.label;
  const credentials = `Usuario: ${requiresRu(role) ? 'RU' : 'CI'} · Contraseña: CI`;
  const step = operationId ? 2 : preview ? 1 : 0;
  const canImport = !!file && !!preview && preview.invalid === 0 && preview.valid > 0;

  // A synchronous lock also prevents duplicate requests before React renders the busy state.
  const run = async (action: () => Promise<void>) => {
    if (lock.current || !allowed) return;
    lock.current = true;
    setBusy(true);
    setError('');

    try {
      await action();
    } catch (cause) {
      setError(getApiErrorMessage(cause));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  const reset = () => {
    if (lock.current) return;
    setFile(null);
    setPreview(null);
    rememberOperation(null);
    setError('');
    setConfirm(false);
  };

  const download = () =>
    run(async () => {
      const blob = await downloadUserImportTemplate(role);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');

      anchor.href = url;
      anchor.download = `plantilla-usuarios-${role.toLowerCase()}.xlsx`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    });

  const review = () => {
    if (!file || lock.current) return;
    const validation = validateImportFile(file);

    if (validation) {
      setError(validation);

      return;
    }

    void run(async () => setPreview(await previewUserImport(file, role)));
  };

  const confirmOperation = async (id: string) => {
    try {
      await confirmUserImport(id);
      rememberOperation(id);
    } catch (cause) {
      // A lost acknowledgement must not report that the background import stopped.
      const status = await getUserImportStatus(id).catch(() => null);

      if (status && (status.status === 'IMPORTING' || isImportTerminal(status.status))) {
        rememberOperation(id);
      } else if (!status && isAxiosError(cause) && (!cause.response || cause.response.status >= 500)) {
        // Keep the identifier even if both acknowledgements are unavailable.
        rememberOperation(id);
      } else throw cause;
    }
  };

  const submit = () => {
    if (!canImport || !preview || lock.current) return;
    setConfirm(false);
    void run(() => confirmOperation(preview.operationId));
  };

  if (loading) return <LinearProgress aria-label='Cargando permisos' />;
  if (!allowed) return <Alert severity='warning'>No tienes permiso para importar usuarios.</Alert>;

  return (
    <Stack spacing={3}>
      <Box>
        <Button onClick={() => router.push(usersPath)} disabled={busy} startIcon={<i className='ri-arrow-left-line' />}>
          Volver a usuarios
        </Button>
      </Box>
      <Box>
        <Typography variant='h4' component='h1'>
          Importar usuarios
        </Typography>
        <Typography color='text.secondary'>Crea múltiples usuarios mediante un archivo Excel.</Typography>
      </Box>
      <Stepper activeStep={step} alternativeLabel>
        {['Configuración', 'Revisión', 'Resultado'].map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>
      {busy && (
        <Box role='status'>
          <Typography variant='body2' sx={{ mb: 1 }}>
            {preview ? 'Importando usuarios…' : 'Procesando solicitud…'}
          </Typography>
          <LinearProgress />
        </Box>
      )}
      {!!error && (
        <Alert severity='error' sx={{ whiteSpace: 'pre-line' }}>
          {error}
        </Alert>
      )}
      {step === 0 && (
        <Paper variant='outlined' sx={{ p: { xs: 3, md: 5 }, borderRadius: 2 }}>
          <Stack spacing={3}>
            <Typography variant='h6'>Configuración de la importación</Typography>
            <TextField
              select
              label='Rol de los usuarios'
              value={role}
              disabled={busy}
              onChange={(event) => {
                setRole(event.target.value as ImportRole);
                setError('');
              }}
              sx={{ maxWidth: 420 }}
            >
              {importRoles.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
            <Alert severity='info'>
              <Typography variant='body2'>
                RU {requiresRu(role) ? 'obligatorio' : 'opcional'}. {credentials}.
              </Typography>
              {(role === 'DIRECTOR' || role === 'DEAN') && (
                <Typography variant='body2'>
                  La importación solo asigna el rol; no asigna una carrera ni una facultad automáticamente.
                </Typography>
              )}
            </Alert>
            <Box>
              <Button
                variant='outlined'
                disabled={busy}
                onClick={() => void download()}
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
                    aria-label='Seleccionar archivo Excel'
                    disabled={busy}
                    style={{
                      position: 'absolute',
                      width: 1,
                      height: 1,
                      padding: 0,
                      overflow: 'hidden',
                      clipPath: 'inset(50%)',
                    }}
                    onChange={(event) => {
                      const selected = event.target.files?.[0];

                      event.target.value = '';
                      if (!selected) return;
                      const validation = validateImportFile(selected);

                      setError(validation);
                      setFile(validation ? null : selected);
                    }}
                  />
                </Button>
                {file && (
                  <Typography variant='body2' sx={{ overflowWrap: 'anywhere' }}>
                    {file.name} · {fileSize(file.size)}
                  </Typography>
                )}
              </Stack>
            </Paper>
            <Box sx={{ textAlign: 'right' }}>
              <Button variant='contained' disabled={!file || busy} onClick={review}>
                Revisar archivo
              </Button>
            </Box>
          </Stack>
        </Paper>
      )}
      {step === 1 && preview && file && (
        <Paper variant='outlined' sx={{ p: { xs: 3, md: 5 }, borderRadius: 2 }}>
          <Stack spacing={3}>
            <Typography variant='h6'>Resumen de la importación</Typography>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
              <Box sx={{ flex: 2, minWidth: 0 }}>
                <Typography color='text.secondary' variant='body2'>
                  Archivo
                </Typography>
                <Typography sx={{ overflowWrap: 'anywhere' }}>{file.name}</Typography>
                <Typography variant='body2' color='text.secondary'>
                  {fileSize(file.size)} · {preview.total} filas detectadas
                </Typography>
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography color='text.secondary' variant='body2'>
                  Rol de los usuarios
                </Typography>
                <Typography>{roleLabel}</Typography>
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography color='text.secondary' variant='body2'>
                  Credenciales iniciales
                </Typography>
                <Typography>{credentials}</Typography>
              </Box>
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              {[
                { label: 'Total', value: preview.total, color: 'primary.main' },
                { label: 'Válidos', value: preview.valid, color: 'success.main' },
                { label: 'Con errores', value: preview.invalid, color: 'error.main' },
              ].map((item) => (
                <Paper key={item.label} variant='outlined' sx={{ flex: 1, p: 3 }}>
                  <Typography variant='h4' color={item.color}>
                    {item.value}
                  </Typography>
                  <Typography color='text.secondary'>{item.label}</Typography>
                </Paper>
              ))}
            </Stack>
            <Alert severity={preview.invalid > 0 ? 'warning' : 'success'}>
              {preview.invalid > 0
                ? `Se encontraron ${preview.invalid} filas con errores. Corrige el archivo y vuelve a revisarlo para poder importar. No se importará ninguna fila mientras existan errores.`
                : 'El archivo no contiene filas inválidas y está listo para importar.'}
            </Alert>
            <ImportReviewTable key={preview.operationId} preview={preview} busy={busy} />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent='space-between'>
              <Button variant='outlined' disabled={busy} onClick={reset}>
                Elegir otro archivo
              </Button>
              <Button variant='contained' disabled={busy || !canImport} onClick={() => setConfirm(true)}>
                Importar {preview.valid} usuarios
              </Button>
            </Stack>
          </Stack>
        </Paper>
      )}
      {step === 2 && operationId && (
        <Paper variant='outlined' sx={{ p: 5, borderRadius: 2 }}>
          <Stack spacing={3} alignItems='center' textAlign='center'>
            <Typography variant='h5' component='h2'>
              {execution?.status === 'COMPLETED'
                ? 'Importación completada'
                : execution?.status === 'COMPLETED_WITH_ERRORS'
                  ? 'Importación completada con errores'
                  : execution?.status === 'FAILED'
                    ? 'La importación no pudo completarse'
                    : execution?.status === 'EXPIRED'
                      ? 'La operación expiró'
                      : execution?.status === 'READY'
                        ? 'La operación aún no está confirmada'
                        : 'Importando usuarios'}
            </Typography>
            {progressError && (
              <Alert severity='warning'>
                No se pudo actualizar el estado: {progressError}. La importación puede seguir ejecutándose.
              </Alert>
            )}
            {execution ? (
              <Box sx={{ width: '100%' }} role='status'>
                <Typography>
                  {execution.processed + execution.failed} de {execution.total} filas procesadas
                </Typography>
                <Typography>{execution.progress.toLocaleString('es', { maximumFractionDigits: 1 })} %</Typography>
                <LinearProgress variant='determinate' value={execution.progress} sx={{ my: 2 }} />
                <Typography>
                  {execution.processed} usuarios creados · Fallidos: {execution.failed}
                </Typography>
              </Box>
            ) : (
              <Typography>Consultando estado de la operación…</Typography>
            )}
            {execution?.status === 'FAILED' && (
              <Alert severity='error'>
                La operación se detuvo por un fallo global. Los lotes ya confirmados se conservaron.
              </Alert>
            )}
            {execution?.status === 'COMPLETED_WITH_ERRORS' && (
              <Alert severity='warning'>Las filas fallidas no se importaron. No se reintentarán automáticamente.</Alert>
            )}
            {preview && (
              <Typography>
                Rol: {roleLabel}
                <br />
                {credentials}
              </Typography>
            )}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <Button variant='outlined' onClick={reset} disabled={!terminal && execution?.status !== 'READY'}>
                Importar otro archivo
              </Button>
              {execution?.status === 'READY' && (
                <Button
                  variant='contained'
                  disabled={busy}
                  onClick={() => void run(() => confirmOperation(operationId))}
                >
                  Confirmar importación
                </Button>
              )}
              <Button onClick={() => router.push(usersPath)} variant='contained'>
                Volver a usuarios
              </Button>
            </Stack>
          </Stack>
        </Paper>
      )}
      <Dialog
        open={confirm}
        onClose={() => {
          if (!busy) setConfirm(false);
        }}
        fullWidth
        maxWidth='xs'
        aria-labelledby='confirm-import-title'
      >
        <DialogTitle id='confirm-import-title'>Confirmar importación</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Se crearán {preview?.valid ?? 0} usuarios con el rol {roleLabel}.
          </DialogContentText>
          <DialogContentText sx={{ mt: 2 }}>{credentials}.</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={() => setConfirm(false)}>
            Cancelar
          </Button>
          <Button variant='contained' disabled={busy || !canImport} onClick={submit}>
            Confirmar importación
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
