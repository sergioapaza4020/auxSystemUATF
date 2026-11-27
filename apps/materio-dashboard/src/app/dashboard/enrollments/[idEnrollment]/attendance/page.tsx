'use client';

import { useEffect, useRef, useState } from 'react';

import { useParams, useRouter } from 'next/navigation';

import {
  Box,
  Button,
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

import { PageLoading } from '@/components/feedback/PageLoading';

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
import { AttendanceImportDialog } from '@/views/attendance/AttendanceImportDialog';
import { AttendanceSessionToolbar } from '@/views/attendance/AttendanceSessionToolbar';
import { AttendanceSheet } from '@/views/attendance/AttendanceSheet';
import { AttendanceHistory } from '@/views/attendance/AttendanceHistory';
import { DateField } from '@/components/DateField';
import { AttendanceTopicDialog } from '@/views/attendance/AttendanceTopicDialog';
import { AttendanceCreateDialog } from '@/views/attendance/AttendanceCreateDialog';
import { AttendanceQrConfigDialog } from '@/views/attendance/AttendanceQrConfigDialog';
import { attendanceQrError } from '@/utils/attendance-qr';
import { AttendanceGeolocationDialog } from '@/views/attendance/AttendanceGeolocationDialog';
import { AttendanceSessionBadge } from '@/views/attendance/AttendanceSessionBadge';
import { AttendanceManualContingencyDialog } from '@/views/attendance/AttendanceManualContingencyDialog';
import { AttendanceAuditDialog } from '@/views/attendance/AttendanceAuditDialog';
import { AttendanceQrPresentationDialog } from '@/views/attendance/AttendanceQrPresentationDialog';
import type { IEnrollmentStudent } from '@/interfaces/enrollments/enrollment-student.interface';
import type { AttendanceSessionMode } from '@/interfaces/attendances/attendance.interface';
import { attendanceLocalTime, canEditAttendance, getAttendanceGeoErrorMessage } from '@/utils/attendance-geolocation';

type PendingAttendanceAction =
  | { kind: 'create'; mode?: AttendanceSessionMode; date?: string; topic?: string | null }
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

  const canImport =
    canSave &&
    hasPermission(user, 'attendance.session.get-by-enrollment') &&
    hasPermission(user, 'enrollment.get-students-by-enrollment');

  const [importOpen, setImportOpen] = useState(false);

  const canEditConfig =
    hasPermission(user, 'assistant-grade-scheme.update') && hasPermission(user, 'assistant-grade-scheme.get-one');

  const { enrollment, loading: loadingEnrollment } = useEnrollment(idEnrollment);

  const {
    sessions,
    recentSessions,
    recentLoading,
    meta: historyMeta,
    changeQuery: changeHistoryQuery,
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

  const [selectedDate, setSelectedDate] = useState(() => attendanceLocalTime(new Date().toISOString()).slice(0, 10));

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
  const [creatingSession, setCreatingSession] = useState(false);
  const [editingTopic, setEditingTopic] = useState(false);
  const [geoDialog, setGeoDialog] = useState(false);
  const [qrDialog, setQrDialog] = useState(false);
  const [qrPresent, setQrPresent] = useState(false);
  const actionLock = useRef(false);

  const selected =
    session?.idAttendanceSession === selectedSessionId
      ? session
      : roster.session?.idAttendanceSession === selectedSessionId
        ? roster.session
        : null;

  const combined = selected?.mode === 'GEOLOCATION_QR';
  const [contingency, setContingency] = useState<IEnrollmentStudent | null>(null);
  const [auditOpen, setAuditOpen] = useState(false);
  const geo = selected?.mode === 'GEOLOCATION';
  const qr = selected?.mode === 'QR';
  const selfRegistration = geo || qr || combined;
  const refreshQrLifecycle = useRef(loadSession);

  refreshQrLifecycle.current = loadSession;
  useEffect(() => {
    if (
      openingSession ||
      (!qr && !combined) ||
      !selected ||
      (selected.state !== 'SCHEDULED' && selected.state !== 'OPEN')
    )
      return;
    const id = selected.idAttendanceSession;
    const boundary = selected.state === 'SCHEDULED' ? selected.startsAt : selected.endsAt;
    let active = true;
    let pending = false;
    let timer: ReturnType<typeof setTimeout>;

    const check = async () => {
      if (!active || pending || document.visibilityState === 'hidden') return;
      pending = true;

      try {
        await refreshQrLifecycle.current(id);
      } catch {
        /* Manual refresh remains available. */
      } finally {
        pending = false;
      }
    };

    const schedule = () => {
      const untilBoundary = Date.parse(boundary ?? '') - Date.now() + 100;
      const delay = untilBoundary > 0 ? Math.min(60000, untilBoundary) : 30000;

      timer = setTimeout(
        async () => {
          await check();
          if (active && selected.state === 'SCHEDULED') schedule();
        },
        Number.isFinite(delay) ? delay : 60000,
      );
    };

    const focus = () => {
      if (!qrDialog) void check();
    };

    if (!qrDialog) schedule();
    window.addEventListener('focus', focus);

    return () => {
      active = false;
      clearTimeout(timer);
      window.removeEventListener('focus', focus);
    };
  }, [qr, combined, selected, qrDialog, openingSession]);
  const rosterRefresh = useRef(roster.refresh);

  rosterRefresh.current = roster.refresh;
  useEffect(() => {
    if (openingSession || !combined || selected?.state !== 'OPEN') return;
    let active = true;
    let pending = false;

    const refresh = async () => {
      if (!active || pending || document.visibilityState === 'hidden') return;
      pending = true;

      try {
        await refreshQrLifecycle.current(selected.idAttendanceSession);
        if (active) rosterRefresh.current?.();
      } catch {
        /* An explicit refresh and the QR error remain available. */
      } finally {
        pending = false;
      }
    };

    const timer = window.setInterval(() => void refresh(), 15000);

    window.addEventListener('focus', refresh);

    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
    };
  }, [combined, selected?.idAttendanceSession, selected?.state, openingSession]);
  const editable = canEditAttendance(selected);

  const geoMarks = roster.geographicStudentIds;

  const hasGeoMarks =
    geoMarks.length > 0 ||
    !!session?.attendances?.some(
      (mark) =>
        mark.registrationMethod === 'GEOLOCATION' ||
        mark.registrationMethod === 'QR' ||
        mark.registrationMethod === 'GEOLOCATION_QR',
    );

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
    setEditingTopic(false);
    setGeoDialog(loaded.mode === 'GEOLOCATION' || loaded.mode === 'GEOLOCATION_QR');
    setContingency(null);
    setAuditOpen(false);
    setQrPresent(false);
    setQrDialog(loaded.mode === 'QR');
  };

  const performAction = async (action: PendingAttendanceAction) => {
    if (action.kind === 'back') {
      router.push(`/dashboard/enrollments/${idEnrollment}`);

      return;
    }

    if (actionLock.current) return;
    actionLock.current = true;
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
        const date = action.date ?? selectedDate;

        if (!date) {
          snackbar.error('Selecciona una fecha.');

          return;
        }

        const created =
          action.topic !== undefined
            ? await createSession(date, action.mode, action.topic)
            : action.mode === 'GEOLOCATION' || action.mode === 'QR' || action.mode === 'GEOLOCATION_QR'
              ? await createSession(date, action.mode)
              : await createSession(date);

        try {
          await openSession(created.idAttendanceSession);
        } catch (error) {
          if (action.mode === 'QR' || action.mode === 'GEOLOCATION' || action.mode === 'GEOLOCATION_QR') {
            snackbar.warning('Borrador creado. No se pudo abrir su detalle; retómalo desde el historial.');

            return;
          }

          throw error;
        }

        if (action.mode === 'GEOLOCATION' || action.mode === 'GEOLOCATION_QR') setGeoDialog(true);
        if (action.mode === 'QR') setQrDialog(true);
        snackbar.success(action.mode === 'QR' ? 'Sesión QR creada.' : 'Sesión de asistencia creada.');
      }
    } catch (error) {
      snackbar.error(
        action.kind === 'create' && action.mode === 'QR'
          ? attendanceQrError(error)
          : action.kind === 'create'
            ? getAttendanceGeoErrorMessage(error)
            : action.kind === 'delete'
              ? 'No se pudo eliminar la sesión. Tus cambios actuales se conservan.'
              : action.kind === 'update'
                ? 'No se pudo actualizar la fecha de la sesión. Tus cambios actuales se conservan.'
                : 'No se pudo abrir la sesión de asistencia. Tus marcas actuales se conservan.',
      );
    } finally {
      actionLock.current = false;
      setOpeningSession(false);
      if (action.kind === 'create') setCreatingSession(false);
    }
  };

  const requestAction = (action: PendingAttendanceAction) => {
    if (
      actionLock.current ||
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

  const handleChangeAttendance = (id: number, status: AttendanceStatus) => {
    if (!combined && editable && !geoMarks.includes(id)) roster.edit(id, status);
  };

  const handleMarkAll = (status: AttendanceStatus) => {
    if (!combined && editable && !hasGeoMarks) roster.markAllStudents(status);
  };

  const handleCancelChanges = () => roster.discard();

  const handleSave = async () => {
    if (
      combined ||
      !selectedSessionId ||
      !canSave ||
      !editable ||
      !hasChanges ||
      Object.values(observations).some((value) => (value?.length ?? 0) > 500)
    ) {
      return;
    }

    try {
      await saveSessionAttendances(selectedSessionId, roster.payload());
      roster.confirmed();
    } catch (error) {
      snackbar.error(`No se pudo guardar la asistencia: ${getAttendanceGeoErrorMessage(error)}`);

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
    return <PageLoading minHeight={300} />;
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
      {canImport && (
        <Box>
          <Button
            variant='outlined'
            disabled={saving || openingSession || hasChanges}
            onClick={() => setImportOpen(true)}
          >
            Importar asistencia desde Excel
          </Button>
        </Box>
      )}
      {importOpen && (
        <AttendanceImportDialog
          enrollmentId={idEnrollment}
          onClose={() => setImportOpen(false)}
          onImported={() => {
            roster.refresh();
            void loadSessions().catch((error) => snackbar.error(getApiErrorMessage(error)));
            if (selectedSessionId !== null)
              void loadSession(selectedSessionId).catch((error) => snackbar.error(getApiErrorMessage(error)));
          }}
        />
      )}

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
                session={selected}
                saving={saving || openingSession}
                canCreate={canCreate && canOpen}
                hasChanges={hasChanges}
                onEditTopic={
                  selected && selected.state !== 'CANCELLED' && hasPermission(user, 'attendance.session.update')
                    ? () => setEditingTopic(true)
                    : undefined
                }
                onDateChange={setSelectedDate}
                onCreateSession={() => setCreatingSession(true)}
                onConfigureQr={
                  qr
                    ? () => {
                        setQrPresent(false);
                        setQrDialog(true);
                      }
                    : undefined
                }
                onShowQr={
                  (qr || combined) && selected?.state === 'OPEN' && hasPermission(user, 'attendance.qr.get')
                    ? () => {
                        setQrPresent(true);
                        if (!combined) setQrDialog(true);
                      }
                    : undefined
                }
              />

              {selfRegistration && selected && (
                <Paper variant='outlined' sx={{ p: 2 }}>
                  <Stack spacing={1}>
                    <AttendanceSessionBadge session={selected} />
                    <Typography variant='body2'>
                      {selected.state === 'OPEN'
                        ? 'En curso — todavía no afecta el cálculo final.'
                        : selected.state === 'CLOSED'
                          ? 'Finalizada — asistencia consolidada.'
                          : selected.state === 'CANCELLED'
                            ? 'Sesión cancelada.'
                            : 'La sesión aún no está abierta.'}
                    </Typography>
                    <Button
                      onClick={() => {
                        if (qr) {
                          setQrPresent(false);
                          setQrDialog(true);
                        } else setGeoDialog(true);
                      }}
                      disabled={saving || openingSession || hasChanges}
                    >
                      {qr
                        ? 'Ver configuración QR'
                        : selected.state === 'DRAFT'
                          ? 'Configurar geolocalización'
                          : 'Ver ubicación/configuración'}
                    </Button>
                    <Button
                      onClick={async () => {
                        try {
                          await loadSession(selected.idAttendanceSession);
                          roster.refresh?.();
                        } catch (error) {
                          snackbar.error(getAttendanceGeoErrorMessage(error));
                        }
                      }}
                      disabled={saving || openingSession || hasChanges}
                    >
                      Actualizar estado y registros
                    </Button>
                  </Stack>
                </Paper>
              )}

              {combined && selected && canOpen && (
                <Button onClick={() => setAuditOpen(true)}>Historial de cambios</Button>
              )}
              {selectedSessionId && (
                <AttendanceSheet
                  combined={combined}
                  sessionState={selected?.state}
                  records={roster.session?.idAttendanceSession === selectedSessionId ? roster.session.attendances : []}
                  pendingCount={roster.session?.pendingCount ?? selected?.pendingCount ?? 0}
                  onContingency={combined && canSave && editable ? setContingency : undefined}
                  pagination={{ meta: roster.meta, query: roster.query, changeQuery: roster.changeQuery }}
                  onRefresh={roster.refresh}
                  students={students}
                  totalStudents={roster.total}
                  attendance={attendance}
                  observations={observations}
                  onChangeObservation={(id, value) => {
                    if (!combined && editable && !geoMarks.includes(id))
                      roster.edit(id, AttendanceStatus.EXCUSED, value);
                  }}
                  loading={loadingStudents || openingSession || !session}
                  saving={saving}
                  readOnly={!canSave || !editable}
                  lockedStudentIds={geoMarks}
                  markAllDisabled={combined || hasGeoMarks}
                  pending={selfRegistration && selected?.isComputable === false}
                  pendingStudentIds={
                    roster.markAllActive
                      ? []
                      : students
                          .filter(
                            (student) =>
                              !roster.session?.attendances.some(
                                (mark) => mark.enrollment.idEnrollment === student.idEnrollment,
                              ) && !modifiedStudentIds.includes(student.idEnrollment),
                          )
                          .map((student) => student.idEnrollment)
                  }
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
              summary={selected}
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
          onRefresh={() => {
            void loadSessions().catch((error) => snackbar.error(getApiErrorMessage(error)));
          }}
          refreshDisabled={hasChanges}
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
          onCreateSession={canCreate ? () => setCreatingSession(true) : undefined}
          disabled={saving || openingSession || !canOpen}
        />
      </Box>
      {editingTopic &&
        selected &&
        hasPermission(user, 'attendance.session.update') &&
        selected.state !== 'CANCELLED' && (
          <AttendanceTopicDialog
            key={selected.idAttendanceSession}
            session={selected}
            onClose={() => setEditingTopic(false)}
            onSaved={async () => {
              await loadSession(selected.idAttendanceSession);
              roster.refresh?.();
              await loadSessions();
            }}
          />
        )}
      {creatingSession && (
        <AttendanceCreateDialog
          creating={openingSession}
          initialDate={selectedDate}
          onClose={() => setCreatingSession(false)}
          onCreate={(mode, date, topic) => {
            requestAction({ kind: 'create', mode, date, ...(topic !== undefined ? { topic } : {}) });
          }}
        />
      )}
      {geoDialog && selected && (geo || combined) && (
        <AttendanceGeolocationDialog
          key={selected.idAttendanceSession}
          session={selected}
          canUpdate={hasPermission(user, 'attendance.session.update')}
          onClose={() => setGeoDialog(false)}
          onRefresh={async () => {
            await loadSession(selected.idAttendanceSession);
            roster.refresh?.();
            await loadSessions();
          }}
        />
      )}
      {combined && selected && selected.state === 'OPEN' && qrPresent && (
        <AttendanceQrPresentationDialog
          key={selected.idAttendanceSession}
          session={selected}
          course={`${enrollment.course.name}${enrollment.course.group != null ? ` · Grupo ${enrollment.course.group}` : ''}`}
          onClose={() => setQrPresent(false)}
          onUnavailable={() => {
            setQrPresent(false);
            void loadSession(selected.idAttendanceSession)
              .then(() => roster.refresh?.())
              .catch(() => snackbar.error('Actualiza el estado de la sesión.'));
          }}
        />
      )}
      {combined && selected && contingency && canSave && editable && (
        <AttendanceManualContingencyDialog
          key={`${selected.idAttendanceSession}-${contingency.idEnrollment}`}
          session={selected}
          student={contingency}
          existing={roster.session?.attendances.find(
            (mark) => mark.enrollment.idEnrollment === contingency.idEnrollment,
          )}
          onClose={() => setContingency(null)}
          onSaved={async () => {
            await loadSession(selected.idAttendanceSession);
            roster.refresh?.();
            await loadSessions();
          }}
        />
      )}
      {combined && selected && auditOpen && canOpen && (
        <AttendanceAuditDialog
          key={selected.idAttendanceSession}
          idSession={selected.idAttendanceSession}
          onClose={() => setAuditOpen(false)}
        />
      )}
      {qrDialog && selected && qr && (
        <AttendanceQrConfigDialog
          key={selected.idAttendanceSession}
          session={selected}
          course={`${enrollment.course.name}${enrollment.course.group != null ? ` · Grupo ${enrollment.course.group}` : ''}`}
          initialPresentation={qrPresent}
          canUpdate={hasPermission(user, 'attendance.session.update')}
          canGetQr={hasPermission(user, 'attendance.qr.get')}
          canDelete={hasPermission(user, 'attendance.session.delete')}
          onClose={() => {
            setQrDialog(false);
            setQrPresent(false);
          }}
          onRefresh={async () => {
            await loadSession(selected.idAttendanceSession);
            roster.refresh?.();
            await loadSessions();
          }}
          onDelete={async () => {
            await deleteAttendanceSession(selected.idAttendanceSession);
            setSelectedSessionId(null);
            roster.discard();
            await loadSessions();
          }}
        />
      )}
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
