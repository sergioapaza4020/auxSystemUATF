'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import TablePagination from '@mui/material/TablePagination';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import { getOwnSessions, revokeOwnSessions } from '@/api/account-settings.service';
import type { OwnSession } from '@/interfaces/auth/account-settings.interface';
import { getApiErrorMessage } from '@/utils/http/getApiErrorMessage';
import { useSnackbar } from '@/hooks/useSnackbar';

const dateFormat = new Intl.DateTimeFormat('es-BO', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'America/La_Paz',
});

const limit = 5;
const rowColumns = { xs: 'minmax(0, 1fr) auto', sm: 'minmax(0, 1fr) minmax(0, 1fr) auto' };

export default function SessionSettings({ idSession }: { idSession: number }) {
  const { success } = useSnackbar();
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [rows, setRows] = useState<OwnSession[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [target, setTarget] = useState<number | 'others' | null>(null);
  const [revokeError, setRevokeError] = useState('');
  const [revoking, setRevoking] = useState(false);
  const revokeRequest = useRef<AbortController | null>(null);

  useLayoutEffect(() => () => revokeRequest.current?.abort(), []);

  useEffect(() => {
    const controller = new AbortController();

    setLoading(true);
    setError('');
    void getOwnSessions(idSession, page + 1, limit, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        const lastPage = Math.max(0, result.meta.totalPages - 1);

        if (page > lastPage) {
          setPage(lastPage);

          return;
        }

        setRows(result.data);
        setTotal(result.meta.total);
        setLoading(false);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setError('No pudimos consultar tus sesiones activas.');
        setLoading(false);
      });

    return () => controller.abort();
  }, [idSession, page, revision]);

  function refresh() {
    setLoading(true);
    setRevision((value) => value + 1);
  }

  function confirm(targetSession: number | 'others') {
    setRevokeError('');
    setTarget(targetSession);
  }

  async function revoke() {
    if (target === null || revokeRequest.current) return;
    const controller = new AbortController();

    revokeRequest.current = controller;
    setRevoking(true);
    setRevokeError('');

    try {
      await revokeOwnSessions(idSession, controller.signal, target === 'others' ? undefined : target);
      if (controller.signal.aborted) return;
      success(target === 'others' ? 'Cerraste las demás sesiones.' : 'Cerraste la sesión seleccionada.');
      setTarget(null);
      refresh();
    } catch (failure) {
      if (!controller.signal.aborted) {
        setRevokeError(`No pudimos confirmar el cierre. ${getApiErrorMessage(failure)}`);
      }
    } finally {
      revokeRequest.current = null;
      if (!controller.signal.aborted) setRevoking(false);
    }
  }

  return (
    <Stack spacing={2} aria-busy={loading}>
      <Stack direction='row' alignItems='center' justifyContent='space-between' gap={1}>
        <Typography component='h3' variant='h6'>
          Sesiones activas
        </Typography>
        <Tooltip title='Actualizar sesiones'>
          <span>
            <IconButton aria-label='Actualizar sesiones' onClick={refresh} disabled={loading || revoking}>
              <i className='ri-refresh-line' aria-hidden />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>
      <Typography variant='body2' color='text.secondary'>
        Revisa dónde has iniciado sesión y cierra las sesiones que ya no utilices.
      </Typography>
      {loading && <LinearProgress aria-label='Consultando sesiones' />}
      {error ? (
        <Alert
          severity='error'
          action={
            <Button onClick={refresh} size='small'>
              Reintentar
            </Button>
          }
        >
          {error}
        </Alert>
      ) : (
        <>
          {!loading && rows.length === 0 && <Typography variant='body2'>No hay sesiones activas.</Typography>}
          {!loading && total === 1 && rows[0]?.current && (
            <Typography variant='body2' color='text.secondary'>
              Solo está activa tu sesión actual.
            </Typography>
          )}
          {rows.length > 0 && (
            <Box
              component='ul'
              aria-label='Dispositivos con sesión activa'
              sx={{ m: 0, p: 0, listStyle: 'none', border: 1, borderColor: 'divider', borderRadius: 1 }}
            >
              {rows.map((session) => (
                <Box
                  component='li'
                  key={session.idSession}
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: rowColumns,
                    alignItems: 'center',
                    gap: 2,
                    p: 2.5,
                    '& + &': { borderTop: 1, borderColor: 'divider' },
                  }}
                >
                  <Box sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                    <Typography variant='subtitle2'>
                      {[session.os, session.browser].filter(Boolean).join(' · ') || 'Navegador sin identificar'}
                    </Typography>
                    {session.device && (
                      <Typography variant='body2' color='text.secondary'>
                        {session.device}
                      </Typography>
                    )}
                  </Box>
                  <Box sx={{ gridColumn: { xs: '1 / -1', sm: 'auto' }, gridRow: { xs: 2, sm: 'auto' } }}>
                    <Typography variant='body2'>Inicio · {dateFormat.format(new Date(session.createdAt))}</Typography>
                    <Typography variant='body2' color='text.secondary'>
                      Última actividad ·{' '}
                      {session.lastUsedAt ? dateFormat.format(new Date(session.lastUsedAt)) : 'Sin registrar'}
                    </Typography>
                  </Box>
                  <Stack direction='row' alignItems='center' gap={1}>
                    <Chip
                      size='small'
                      label={session.current ? 'Actual' : 'Activa'}
                      color={session.current ? 'success' : 'default'}
                    />
                    {!session.current && (
                      <Tooltip title='Cerrar sesión'>
                        <span>
                          <IconButton
                            aria-label={`Cerrar sesión ${[session.os, session.browser].filter(Boolean).join(' ')} (${session.idSession})`}
                            disabled={loading || revoking}
                            onClick={() => confirm(session.idSession)}
                            color='error'
                          >
                            <i className='ri-logout-box-r-line' aria-hidden />
                          </IconButton>
                        </span>
                      </Tooltip>
                    )}
                  </Stack>
                </Box>
              ))}
            </Box>
          )}
          {total > limit && (
            <TablePagination
              component='div'
              count={total}
              page={page}
              rowsPerPage={limit}
              rowsPerPageOptions={[]}
              onPageChange={(_, next) => {
                setLoading(true);
                setPage(next);
              }}
              labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count}`}
              getItemAriaLabel={(type) => (type === 'next' ? 'Página siguiente' : 'Página anterior')}
              backIconButtonProps={{ disabled: loading || revoking || page === 0 }}
              nextIconButtonProps={{ disabled: loading || revoking || (page + 1) * limit >= total }}
              sx={{ '& .MuiTablePagination-toolbar': { px: 0 } }}
            />
          )}
          <Box>
            <Button variant='outlined' disabled={loading || revoking || total <= 1} onClick={() => confirm('others')}>
              Cerrar todas las demás sesiones
            </Button>
          </Box>
        </>
      )}
      <Dialog
        open={target !== null}
        onClose={() => !revoking && setTarget(null)}
        fullWidth
        maxWidth='xs'
        aria-labelledby='revoke-title'
        aria-describedby='revoke-description'
      >
        <DialogTitle id='revoke-title'>
          {target === 'others' ? 'Cerrar todas las demás sesiones' : 'Cerrar sesión'}
        </DialogTitle>
        <DialogContent>
          <DialogContentText id='revoke-description'>
            {target === 'others'
              ? 'Se cerrará la sesión en los demás dispositivos.'
              : 'Se cerrará la sesión seleccionada.'}{' '}
            Tu sesión actual seguirá activa.
          </DialogContentText>
          {revoking && <LinearProgress aria-label='Cerrando sesiones' sx={{ mt: 2 }} />}
          {revokeError && (
            <Alert severity='error' sx={{ mt: 2 }}>
              {revokeError}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button autoFocus disabled={revoking} onClick={() => setTarget(null)}>
            Cancelar
          </Button>
          <Button disabled={revoking} variant='contained' onClick={() => void revoke()}>
            Confirmar cierre
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
