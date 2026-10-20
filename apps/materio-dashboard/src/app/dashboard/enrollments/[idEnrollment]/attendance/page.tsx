'use client';

import { useEffect, useRef, useState } from 'react';

import { useParams, useRouter } from 'next/navigation';

import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Stack,
  Typography,
  Grid,
  Tabs,
  Tab,
  Paper,
} from '@mui/material';

import { isAttendanceCriterion } from '@repo/grade-calculations';

import { useAuth } from '@/hooks/useAuth';
import { hasPermission } from '@/utils/hasPermission';
import { AttendanceSidebar } from '@/views/attendance/AttendanceSidebar';
import { AttendancePermissionDialog } from '@/views/attendance/AttendancePermissionDialog';

import { useSnackbar } from '@/hooks/useSnackbar';
import { getApiErrorMessage } from '@/utils/http/getApiErrorMessage';
import { useEnrollment } from '@/hooks/enrollments/useEnrollment';
import { useAttendances } from '@/hooks/attendances/useAttendances';

import { getMyAssistantGradeScheme } from '@/api/assistant-grade-schemes.service';
import { deleteAttendanceSession, updateAttendanceSession } from '@/api/attendances.service';
import { useAttendanceRoster } from '@/hooks/attendances/useAttendanceRoster';

import { AttendanceStatus } from '@/enums/attendanceStatus';
import { AttendancePageHeader } from '@/views/attendance/AttendancePageHeader';
import { AttendanceSessionToolbar } from '@/views/attendance/AttendanceSessionToolbar';
import { AttendanceSheet } from '@/views/attendance/AttendanceSheet';
import { AttendanceHistory } from '@/views/attendance/AttendanceHistory';
import { DateField } from '@/components/DateField';

type PendingAttendanceAction =
  | { kind: 'create' }
  | { kind: 'open'; idSession: number }
  | { kind: 'back' }
  | { kind: 'delete'; idSession: number }
  | { kind: 'update'; idSession: number; date: string };

export default function AttendancePage() {
  const params = useParams();
  const router = useRouter();

  const idEnrollment = Number(params.idEnrollment);

  const snackbar = useSnackbar();
  const { user } = useAuth();
  const canSave = hasPermission(user, 'attendance.save');
  const canCreate = hasPermission(user, 'attendance.session.create');
  const canOpen = hasPermission(user, 'attendance.session.get-one');

  const canEditConfig =
    hasPermission(user, 'assistant-grade-scheme.update') && hasPermission(user, 'assistant-grade-scheme.get-one');

  const { enrollment, loading: loadingEnrollment } = useEnrollment(idEnrollment);

  const {
    sessions,
    recentSessions,
    recentLoading,
    meta: historyMeta,
    changeQuery: changeHistoryQuery,
    findSessionByDate,
    error: historyError,
    loading: loadingSessions,
    saving,
    createSession,
    loadSession,
    loadSessions,
    saveSessionAttendances,
    session,
  } = useAttendances(idEnrollment);

  const historyNotification = useRef(snackbar);

  historyNotification.current = snackbar;
  useEffect(() => {
    if (historyError) historyNotification.current.error(historyError);
  }, [historyError]);

  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();

    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
      2,
      '0',
    )}-${String(now.getDate()).padStart(2, '0')}`;
  });

  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);

  const roster = useAttendanceRoster(idEnrollment, selectedSessionId);
  const { students, attendance, observations, modifiedStudentIds, hasChanges } = roster;
  const { present: presentCount, excused: excusedCount, absent: absentCount } = roster.counts;
  const search = roster.query.search ?? '';
  const loadingStudents = roster.loading;

  useEffect(() => {
    if (roster.error) historyNotification.current.error(roster.error);
  }, [roster.error]);
  const [pendingAction, setPendingAction] = useState<PendingAttendanceAction | null>(null);
  const [openingSession, setOpeningSession] = useState(false);

  const [permissionConfig, setPermissionConfig] = useState<{ weight: number | null; loading: boolean; error: boolean }>(
    { weight: null, loading: true, error: false },
  );

  const [tab, setTab] = useState(0);
  const [editingConfig, setEditingConfig] = useState(false);
  const [historyAction, setHistoryAction] = useState<{ kind: 'delete' | 'update'; idSession: number } | null>(null);
  const [historyDate, setHistoryDate] = useState('');

  useEffect(() => {
    if (!enrollment) return;

    let active = true;

    setPermissionConfig({ weight: null, loading: true, error: false });

    if (!hasPermission(user, 'assistant-grade-scheme.get-one')) {
      setPermissionConfig({ weight: null, loading: false, error: true });

      return;
    }

    void getMyAssistantGradeScheme(enrollment.course.idCourse, enrollment.idEnrollment)
      .then((scheme) => {
        if (!active) return;

        const detail = scheme?.details.find((item) => isAttendanceCriterion(item.gradeItem.name));

        setPermissionConfig({
          weight: detail?.permissionWeight == null ? null : Number(detail.permissionWeight),
          loading: false,
          error: false,
        });
      })
      .catch(() => {
        if (active) setPermissionConfig({ weight: null, loading: false, error: true });
      });

    return () => {
      active = false;
    };
  }, [enrollment, user]);

  useEffect(() => {
    if (!hasChanges) return;

    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', beforeUnload);

    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [hasChanges]);

  /*
   * ============================
   * SESIONES
   * ============================
   */

  const openSession = async (idSession: number) => {
    const loaded = await loadSession(idSession);

    setTab(0);
    setSelectedSessionId(idSession);
    setSelectedDate(loaded.date.slice(0, 10));
  };

  const performAction = async (action: PendingAttendanceAction) => {
    if (action.kind === 'back') {
      router.push(`/dashboard/enrollments/${idEnrollment}`);

      return;
    }

    setOpeningSession(true);

    try {
      if (action.kind === 'delete' || action.kind === 'update') {
        if (action.kind === 'delete') {
          await deleteAttendanceSession(action.idSession);

          if (action.idSession === selectedSessionId) {
            setSelectedSessionId(null);
            roster.discard();
          }

          if (action.idSession !== selectedSessionId) handleCancelChanges();
          snackbar.success('Sesión de asistencia eliminada.');
        } else {
          await updateAttendanceSession(action.idSession, action.date);
          if (action.idSession === selectedSessionId) await openSession(action.idSession);
          else handleCancelChanges();
          snackbar.success('Fecha de la sesión actualizada.');
        }

        try {
          await loadSessions();
        } catch {
          snackbar.error('El cambio se guardó, pero no se pudo actualizar el historial.');
        }
      } else if (action.kind === 'open') {
        await openSession(action.idSession);
      } else {
        if (!selectedDate) {
          snackbar.error('Selecciona una fecha.');

          return;
        }

        const existing = await findSessionByDate(selectedDate);
        const created = existing ?? (await createSession(selectedDate));

        await openSession(created.idAttendanceSession);
        snackbar.success(existing ? 'Se abrió la sesión de asistencia existente.' : 'Sesión de asistencia creada.');
      }
    } catch {
      snackbar.error(
        action.kind === 'delete'
          ? 'No se pudo eliminar la sesión. Tus cambios actuales se conservan.'
          : action.kind === 'update'
            ? 'No se pudo actualizar la fecha de la sesión. Tus cambios actuales se conservan.'
            : 'No se pudo abrir la sesión de asistencia. Tus marcas actuales se conservan.',
      );
    } finally {
      setOpeningSession(false);
    }
  };

  const requestAction = (action: PendingAttendanceAction) => {
    if (
      saving ||
      openingSession ||
      (action.kind === 'create' && (!canCreate || !canOpen)) ||
      (action.kind === 'open' && !canOpen) ||
      (action.kind === 'delete' && !hasPermission(user, 'attendance.session.delete')) ||
      (action.kind === 'update' && !hasPermission(user, 'attendance.session.update'))
    )
      return;
    if (action.kind === 'open' && action.idSession === selectedSessionId) return;

    if (hasChanges) {
      setPendingAction(action);
    } else {
      void performAction(action);
    }
  };

  const handleChangeAttendance = (id: number, status: AttendanceStatus) => roster.edit(id, status);
  const handleMarkAll = (status: AttendanceStatus) => roster.markAllStudents(status);
  const handleCancelChanges = () => roster.discard();

  const handleSave = async () => {
    if (
      !selectedSessionId ||
      !canSave ||
      !hasChanges ||
      Object.values(observations).some((value) => (value?.length ?? 0) > 500)
    ) {
      return;
    }

    try {
      await saveSessionAttendances(selectedSessionId, roster.payload());
      roster.confirmed();
    } catch (error) {
      snackbar.error(`No se pudo guardar la asistencia: ${getApiErrorMessage(error)}`);

      return;
    }

    try {
      await loadSessions();
      snackbar.success('Asistencia guardada correctamente.');
    } catch (error) {
      snackbar.warning(`Asistencia guardada. No se pudo actualizar el historial: ${getApiErrorMessage(error)}`);
    }
  };

  /*
   * ============================
   * ESTADOS DE PÁGINA
   * ============================
   */

  if (loadingEnrollment) {
    return (
      <Box
        sx={{
          minHeight: 300,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (!enrollment) {
    return <Typography color='error'>No se encontró la matriculación.</Typography>;
  }

  return (
    <Stack spacing={3}>
      <AttendancePageHeader
        enrollment={enrollment}
        studentCount={roster.total}
        onBack={() => requestAction({ kind: 'back' })}
      />

      <Paper variant='outlined' sx={{ borderRadius: 2 }}>
        <Tabs
          value={tab}
          onChange={(_, value: number) => setTab(value)}
          variant='scrollable'
          scrollButtons='auto'
          aria-label='Vistas de asistencia'
        >
          {['Asistencia', 'Historial de sesiones'].map((label, index) => (
            <Tab key={label} label={label} id={`attendance-tab-${index}`} aria-controls={`attendance-panel-${index}`} />
          ))}
        </Tabs>
      </Paper>
      <Box role='tabpanel' id='attendance-panel-0' aria-labelledby='attendance-tab-0' hidden={tab !== 0}>
        <Grid container spacing={3} alignItems='flex-start'>
          <Grid item xs={12} lg={9}>
            <Stack spacing={3}>
              <AttendanceSessionToolbar
                selectedDate={selectedDate}
                selectedSessionId={selectedSessionId}
                session={session}
                saving={saving || openingSession}
                canCreate={canCreate && canOpen}
                hasChanges={hasChanges}
                onDateChange={setSelectedDate}
                onCreateSession={() => requestAction({ kind: 'create' })}
              />

              {selectedSessionId && (
                <AttendanceSheet
                  pagination={{ meta: roster.meta, query: roster.query, changeQuery: roster.changeQuery }}
                  students={students}
                  totalStudents={roster.total}
                  attendance={attendance}
                  observations={observations}
                  onChangeObservation={(id, value) => roster.edit(id, AttendanceStatus.EXCUSED, value)}
                  loading={loadingStudents || openingSession || !session}
                  saving={saving}
                  readOnly={!canSave}
                  saveDisabled={Object.values(observations).some((value) => (value?.length ?? 0) > 500)}
                  search={search}
                  presentCount={presentCount}
                  excusedCount={excusedCount}
                  absentCount={absentCount}
                  hasChanges={hasChanges}
                  modifiedStudentIds={modifiedStudentIds}
                  markAllActive={roster.markAllActive}
                  permissionWeight={permissionConfig.weight}
                  permissionWeightLoading={permissionConfig.loading}
                  permissionWeightError={permissionConfig.error}
                  onSearchChange={(value) => roster.changeQuery({ search: value })}
                  onChangeAttendance={handleChangeAttendance}
                  onMarkAllPresent={() => handleMarkAll(AttendanceStatus.PRESENT)}
                  onMarkAllAbsent={() => handleMarkAll(AttendanceStatus.ABSENT)}
                  onCancelChanges={handleCancelChanges}
                  onSave={handleSave}
                />
              )}

              {!selectedSessionId && (
                <Paper variant='outlined' sx={{ p: 4, textAlign: 'center' }}>
                  <Typography variant='h6' sx={{ mb: 1 }}>
                    Planilla de asistencia
                  </Typography>
                  <Typography color='text.secondary'>
                    {roster.total
                      ? 'Crea una sesión o abre una del historial para tomar asistencia.'
                      : 'No hay estudiantes matriculados en esta materia.'}
                  </Typography>
                </Paper>
              )}
            </Stack>
          </Grid>
          <Grid item xs={12} lg={3}>
            <AttendanceSidebar
              sessions={recentSessions}
              summary={roster.session?.idAttendanceSession === selectedSessionId ? roster.session : null}
              selectedSessionId={selectedSessionId}
              present={presentCount}
              excused={excusedCount}
              absent={absentCount}
              total={roster.total}
              hasChanges={hasChanges}
              loading={recentLoading}
              permissionWeight={permissionConfig.weight}
              configLoading={permissionConfig.loading}
              configError={permissionConfig.error}
              canEditConfig={canEditConfig}
              disabled={saving || openingSession || !canOpen}
              onOpenSession={(idSession) => requestAction({ kind: 'open', idSession })}
              onViewHistory={() => setTab(1)}
              onEditConfig={() => setEditingConfig(true)}
            />
          </Grid>
        </Grid>
      </Box>
      <Box role='tabpanel' id='attendance-panel-1' aria-labelledby='attendance-tab-1' hidden={tab !== 1}>
        <AttendanceHistory
          sessions={sessions}
          meta={historyMeta}
          onPageChange={(page) => changeHistoryQuery({ page })}
          onLimitChange={(limit) => changeHistoryQuery({ limit })}
          onEditDate={
            hasPermission(user, 'attendance.session.update')
              ? (idSession, date) => {
                  setHistoryDate(date);
                  setHistoryAction({ kind: 'update', idSession });
                }
              : undefined
          }
          onDeleteSession={
            hasPermission(user, 'attendance.session.delete')
              ? (idSession) => setHistoryAction({ kind: 'delete', idSession })
              : undefined
          }
          loading={loadingSessions}
          selectedSessionId={selectedSessionId}
          onSelectSession={(idSession) => requestAction({ kind: 'open', idSession })}
          onCreateSession={canCreate ? () => requestAction({ kind: 'create' }) : undefined}
          disabled={saving || openingSession || !canOpen}
        />
      </Box>
      {editingConfig && canEditConfig && permissionConfig.weight !== null && (
        <AttendancePermissionDialog
          idCourse={enrollment.course.idCourse}
          idEnrollment={idEnrollment}
          permissionWeight={permissionConfig.weight}
          onClose={() => setEditingConfig(false)}
          onSaved={async (weight) => {
            setPermissionConfig({ weight, loading: false, error: false });

            try {
              await loadSessions();
            } catch {
              snackbar.error('La configuración se guardó, pero no se pudo actualizar el historial.');
            }
          }}
        />
      )}
      <Dialog
        open={!!pendingAction}
        onClose={() => setPendingAction(null)}
        aria-labelledby='attendance-unsaved-title'
        aria-describedby='attendance-unsaved-description'
        maxWidth='xs'
        fullWidth
      >
        <DialogTitle id='attendance-unsaved-title'>Cambios sin guardar</DialogTitle>
        <DialogContent>
          <DialogContentText id='attendance-unsaved-description'>
            Hay cambios de asistencia que todavía no fueron guardados.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setPendingAction(null)}>Continuar editando</Button>
          <Button
            color='error'
            variant='outlined'
            onClick={() => {
              const action = pendingAction;

              setPendingAction(null);
              if (action) void performAction(action);
            }}
          >
            Descartar cambios
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={!!historyAction}
        onClose={() => setHistoryAction(null)}
        maxWidth='xs'
        fullWidth
        aria-labelledby='attendance-history-action-title'
      >
        <DialogTitle id='attendance-history-action-title'>
          {historyAction?.kind === 'delete' ? 'Eliminar sesión' : 'Editar fecha de la sesión'}
        </DialogTitle>
        <DialogContent>
          {historyAction?.kind === 'delete' ? (
            <DialogContentText>
              Se eliminará esta sesión y sus registros de asistencia. Esta acción no se puede deshacer.
            </DialogContentText>
          ) : (
            <DateField fullWidth label='Fecha' value={historyDate} onChange={setHistoryDate} sx={{ mt: 1 }} />
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setHistoryAction(null)}>Cancelar</Button>
          <Button
            variant='contained'
            color={historyAction?.kind === 'delete' ? 'error' : 'primary'}
            disabled={saving || openingSession || (historyAction?.kind === 'update' && !historyDate)}
            onClick={() => {
              const action = historyAction;

              setHistoryAction(null);
              if (action)
                requestAction(
                  action.kind === 'delete'
                    ? { kind: 'delete', idSession: action.idSession }
                    : { ...action, kind: 'update', date: historyDate },
                );
            }}
          >
            {historyAction?.kind === 'delete' ? 'Eliminar sesión' : 'Guardar fecha'}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
