'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useRouter } from 'next/navigation';

import {
  Alert,
  Box,
  Button,
  ButtonBase,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  InputAdornment,
  MenuItem,
  Paper,
  Skeleton,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';

import { useAuth } from '@/hooks/useAuth';
import { useSnackbar } from '@/hooks/useSnackbar';
import { useGradeMatrix } from '@/hooks/grades/useGradeMatrix';
import { useDataTable } from '@/hooks/table/useDataTable';
import { nextStudentCell } from '@/hooks/grades/grade-matrix-state';
import { PaginationTable, type HeadCell } from '@/components/table';
import { hasPermission } from '@/utils/hasPermission';
import { getApiErrorMessage } from '@/utils/http/getApiErrorMessage';
import type { IGradeMatrix } from '@/interfaces/grades/grade-matrix.interface';
import { createActivity, updateActivity, type IActivityCreate } from '@/api/activities.service';
import { ActivityFormDialog } from '../ActivityFormDialog';
import { GradePlanTable, formatGradeDeadline } from './GradePlanTable';
import { GradeChangesBar } from './GradeChangesBar';
import { DEFAULT_GRADE_DISPLAY_MODE, GradeViewToggle, type GradeDisplayMode } from '../GradeViewToggle';

type MatrixStudent = IGradeMatrix['students'][number];

const studentColumns = [
  { id: 'lastname', label: 'Estudiante', sortable: true },
] as const satisfies readonly HeadCell<MatrixStudent>[];

const criterionColors = ['primary', 'secondary', 'success', 'warning'] as const;

export function GradeManagement({ idEnrollment }: { idEnrollment: number }) {
  const router = useRouter();
  const { user } = useAuth();
  const snackbar = useSnackbar();
  const canRead = hasPermission(user, 'grade.get-by-enrollment');
  const canEdit = hasPermission(user, 'grade.create') && hasPermission(user, 'grade.update');
  const canManageActivities = hasPermission(user, 'activity.create');

  const grades = useGradeMatrix(
    idEnrollment,
    canRead && Number.isInteger(idEnrollment) && idEnrollment > 0,
    user?.idUser,
  );

  const [search, setSearch] = useState('');
  const [mode, setMode] = useState<'sheet' | 'activity'>('sheet');
  const [displayMode, setDisplayMode] = useState<GradeDisplayMode>(DEFAULT_GRADE_DISPLAY_MODE);
  const [activityId, setActivityId] = useState<number | null>(null);
  const [activityFormOpen, setActivityFormOpen] = useState(false);
  const [creatingActivity, setCreatingActivity] = useState(false);
  const activityBusy = useRef(false);
  const [pendingFocus, setPendingFocus] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ kind: 'discard' | 'leave'; target?: string } | null>(null);
  const backUrl = `/dashboard/enrollments/${idEnrollment}`;
  const matrix = grades.matrix;

  const filteredStudents = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();

    return (matrix?.students ?? []).filter(
      (student) =>
        !query ||
        `${student.name} ${student.lastname} ${student.ci ?? ''} ${student.ru ?? ''}`
          .toLocaleLowerCase()
          .includes(query),
    );
  }, [matrix?.students, search]);

  const table = useDataTable<MatrixStudent, typeof studentColumns>(filteredStudents, 'lastname', 25, {
    preserveOrder: true,
  });

  const selectedActivity =
    matrix?.activities.find((activity) => activity.idActivity === activityId) ?? matrix?.activities[0];

  const displayedActivities =
    mode === 'activity' ? (selectedActivity ? [selectedActivity] : []) : (matrix?.activities ?? []);

  const resultActivityIds = useMemo(
    () => matrix?.activities.map((activity) => activity.idActivity) ?? [],
    [matrix?.activities],
  );

  const clearPendingFocus = useCallback(() => setPendingFocus(null), []);
  const dirtyCount = grades.changes.length;

  const leave = useCallback(
    (target: string) => {
      if (grades.saving) return;
      if (dirtyCount) setConfirm({ kind: 'leave', target });
      else router.push(target);
    },
    [dirtyCount, grades.saving, router],
  );

  useEffect(() => {
    if (!dirtyCount) return;

    const unload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    const navigation = (event: MouseEvent) => {
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
      const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null;

      if (!link || link.target === '_blank' || link.hasAttribute('download')) return;
      const url = new URL(link.href);

      if (
        url.origin !== window.location.origin ||
        url.pathname + url.search === window.location.pathname + window.location.search
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      leave(url.pathname + url.search + url.hash);
    };

    window.addEventListener('beforeunload', unload);
    document.addEventListener('click', navigation, true);

    return () => {
      window.removeEventListener('beforeunload', unload);
      document.removeEventListener('click', navigation, true);
    };
  }, [dirtyCount, leave]);

  const move = (enrollmentId: number, columnId: number, direction: 1 | -1) => {
    const ids = filteredStudents.map((student) => student.idEnrollment);
    const key = nextStudentCell(enrollmentId, columnId, ids, direction);

    if (!key) return;
    const nextIndex = ids.indexOf(Number(key.split(':')[0]));

    table.handleChangePage(null, Math.floor(nextIndex / table.rowsPerPage));
    setPendingFocus(key);
  };

  const save = async () => {
    try {
      if (await grades.save()) snackbar.success('Calificaciones guardadas correctamente.');
    } catch (error) {
      snackbar.error(getApiErrorMessage(error));
    }
  };

  const create = async (data: IActivityCreate) => {
    if (!canManageActivities || !matrix?.detail || grades.saving || activityBusy.current) return;
    activityBusy.current = true;
    setCreatingActivity(true);

    try {
      const activity = await createActivity(matrix.enrollment.idCourse, {
        ...data,
        gradeSchemeDetailId: matrix.detail.idGradeSchemeDetail,
      });

      // Pin the current criterion before refreshing, including the initial default selection.
      if (mode === 'activity' && selectedActivity) setActivityId(selectedActivity.idActivity);
      grades.selectCriterion(matrix.detail.idGradeSchemeDetail);
      grades.reload();
      snackbar.success('Actividad creada correctamente.');

      return activity;
    } finally {
      activityBusy.current = false;
      setCreatingActivity(false);
    }
  };

  if (!canRead)
    return <Alert severity='warning'>No tienes permiso para consultar las calificaciones de esta materia.</Alert>;

  return (
    <Box>
      <Paper variant='outlined' sx={{ borderRadius: 3, p: { xs: 2, md: 3 }, boxShadow: 'none' }}>
        <Button
          size='small'
          startIcon={<i className='ri-arrow-left-line' />}
          onClick={() => leave(backUrl)}
          disabled={grades.saving}
          sx={{ mb: 2 }}
        >
          Volver a la materia
        </Button>
        {matrix && (
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2}
            justifyContent='space-between'
            alignItems={{ sm: 'center' }}
            sx={{ border: 1, borderColor: 'divider', borderRadius: 2, p: 2, mb: 2.5 }}
          >
            <Stack direction='row' spacing={2} alignItems='center'>
              <Box
                sx={{ p: 1.5, borderRadius: 2, bgcolor: 'primary.lighterOpacity', color: 'primary.main', fontSize: 24 }}
              >
                <i className='ri-graduation-cap-line' />
              </Box>
              <Box>
                <Typography variant='h6' fontWeight={700}>
                  {matrix.enrollment.code} · {matrix.enrollment.name}
                </Typography>
                <Typography variant='body2' color='text.secondary'>
                  Grupo {matrix.enrollment.group} · Auxiliar: {matrix.enrollment.assistantName}
                </Typography>
              </Box>
            </Stack>
            <Button
              variant='outlined'
              startIcon={<i className='ri-bar-chart-line' />}
              onClick={() => leave(backUrl)}
              disabled={grades.saving}
            >
              Ver resumen de estudiantes
            </Button>
          </Stack>
        )}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent='space-between' sx={{ mb: 2 }}>
          <Box>
            <Typography variant='h4' component='h1' fontWeight={700}>
              Calificaciones
            </Typography>
            <Typography color='text.secondary'>Gestiona las notas de las actividades de cada criterio</Typography>
          </Box>
          <ToggleButtonGroup
            exclusive
            size='small'
            value={mode}
            onChange={(_, value: 'sheet' | 'activity' | null) => {
              if (value) setMode(value);
            }}
            aria-label='Vista de calificaciones'
            sx={{
              alignSelf: 'flex-start',
              '& .MuiToggleButton-root.Mui-selected': {
                bgcolor: 'primary.main',
                color: 'primary.contrastText',
                '&:hover': { bgcolor: 'primary.dark' },
              },
            }}
          >
            <ToggleButton value='sheet'>Planilla</ToggleButton>
            <ToggleButton value='activity'>Por actividad</ToggleButton>
          </ToggleButtonGroup>
        </Stack>
        {!canEdit && (
          <Alert severity='info' sx={{ mb: 2 }}>
            Puedes consultar la planilla. Para editar se requieren los permisos de creación y actualización de notas.
          </Alert>
        )}
        {!!matrix?.criteria.length && (
          <Stack
            direction='row'
            spacing={1.5}
            useFlexGap
            flexWrap='wrap'
            role='group'
            aria-label='Criterios de actividades'
            sx={{ mb: 2 }}
          >
            {matrix.criteria.map((criterion, index) => {
              const selected = matrix.detail?.idGradeSchemeDetail === criterion.idGradeSchemeDetail;
              const color = criterionColors[index % criterionColors.length];

              return (
                <ButtonBase
                  key={criterion.idGradeSchemeDetail}
                  disabled={grades.saving}
                  aria-pressed={selected}
                  onClick={() => {
                    setActivityId(null);
                    table.handleChangePage(null, 0);
                    grades.selectCriterion(criterion.idGradeSchemeDetail);
                  }}
                  sx={{
                    border: 1,
                    borderColor: selected ? 'primary.main' : 'divider',
                    borderRadius: 1.5,
                    p: 2,
                    minWidth: 220,
                    textAlign: 'left',
                    justifyContent: 'flex-start',
                    bgcolor: (theme) => alpha(theme.palette[color].main, 0.04),
                    '&.Mui-focusVisible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
                  }}
                >
                  <Stack direction='row' spacing={1.5} alignItems='center'>
                    <Box
                      sx={{
                        p: 1,
                        borderRadius: 1.5,
                        color: `${color}.main`,
                        bgcolor: (theme) => alpha(theme.palette[color].main, 0.1),
                      }}
                    >
                      <i className='ri-file-list-3-line' />
                    </Box>
                    <Box>
                      <Typography variant='body2' fontWeight={700}>
                        {criterion.name}
                      </Typography>
                      <Typography variant='caption' color='text.secondary'>
                        {criterion.activityCount} {criterion.activityCount === 1 ? 'actividad' : 'actividades'} ·{' '}
                        {criterion.percentage}%
                      </Typography>
                    </Box>
                  </Stack>
                </ButtonBase>
              );
            })}
          </Stack>
        )}
        {canManageActivities && matrix?.detail && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
            <Button
              size='small'
              variant='outlined'
              startIcon={<i className='ri-add-line' />}
              disabled={grades.loading || grades.saving || creatingActivity}
              onClick={() => setActivityFormOpen(true)}
            >
              Agregar actividad
            </Button>
          </Box>
        )}
        <Stack direction='row' spacing={2} alignItems='center' useFlexGap flexWrap='wrap' sx={{ mb: 2 }}>
          <GradeViewToggle value={displayMode} onChange={setDisplayMode} />
          <Typography variant='caption' color='text.secondary'>
            Las actividades se registran siempre sobre 100.
          </Typography>
        </Stack>
        {mode === 'activity' && !!matrix?.activities.length && (
          <Stack spacing={0.5} sx={{ mb: 2 }}>
            <TextField
              select
              size='small'
              label='Actividad'
              value={selectedActivity?.idActivity ?? ''}
              onChange={(event) => setActivityId(Number(event.target.value))}
              sx={{ maxWidth: 380 }}
            >
              {matrix.activities.map((activity) => (
                <MenuItem key={activity.idActivity} value={activity.idActivity}>
                  {activity.name}
                </MenuItem>
              ))}
            </TextField>
            {selectedActivity && (
              <Typography variant='caption' color='text.secondary'>
                Fecha límite: {formatGradeDeadline(selectedActivity.dueDate)}
              </Typography>
            )}
          </Stack>
        )}
        <TextField
          fullWidth
          size='small'
          placeholder='Buscar estudiante por nombre, CI o RU...'
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            table.handleChangePage(null, 0);
          }}
          inputProps={{ 'aria-label': 'Buscar estudiante por nombre, CI o RU' }}
          InputProps={{
            startAdornment: (
              <InputAdornment position='start'>
                <i className='ri-search-line' />
              </InputAdornment>
            ),
          }}
          sx={{ mb: 2 }}
        />
        {grades.error ? (
          <Alert severity='error' action={<Button onClick={grades.reload}>Reintentar</Button>}>
            {grades.error}
          </Alert>
        ) : grades.loading ? (
          <Stack spacing={1} aria-label='Cargando planilla'>
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton key={index} variant='rounded' height={48} />
            ))}
          </Stack>
        ) : !matrix?.scheme ? (
          <Alert severity='info'>
            Todavía no existe un esquema de calificación del auxiliar. Configúralo desde el detalle de la materia.
          </Alert>
        ) : !matrix.detail || !matrix.activities.length ? (
          <Alert
            severity='info'
            action={
              canManageActivities && matrix.detail ? (
                <Button onClick={() => setActivityFormOpen(true)} disabled={grades.saving || creatingActivity}>
                  Crear primera actividad
                </Button>
              ) : undefined
            }
          >
            {matrix.detail
              ? `No hay actividades registradas en ${matrix.detail.name}.`
              : 'No existen criterios con actividades para esta planilla. La asistencia y las notas directas se gestionan desde sus pantallas actuales.'}
          </Alert>
        ) : !matrix.students.length ? (
          <Alert severity='info'>No hay estudiantes matriculados en esta materia.</Alert>
        ) : !filteredStudents.length ? (
          <Alert severity='info'>No se encontraron estudiantes. Intenta con otro nombre, CI o RU.</Alert>
        ) : (
          <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
            {!matrix.grades.length && !dirtyCount && (
              <Typography variant='caption' color='text.secondary' sx={{ display: 'block', px: 2, py: 1 }}>
                Todavía no hay calificaciones registradas en este criterio. Las celdas vacías se muestran con --.
              </Typography>
            )}
            <GradePlanTable
              displayMode={displayMode}
              percentage={matrix.detail.percentage}
              assistantPercentage={matrix.scheme.assistantPercentage}
              students={table.visibleRows}
              activities={displayedActivities}
              resultActivityIds={resultActivityIds}
              originals={grades.originals}
              drafts={grades.drafts}
              firstRow={table.page * table.rowsPerPage}
              disabled={!canEdit || grades.saving}
              pendingFocus={pendingFocus}
              onFocusHandled={clearPendingFocus}
              onEdit={grades.edit}
              onMove={move}
            />
            <PaginationTable
              count={filteredStudents.length}
              rowsPerPage={table.rowsPerPage}
              page={table.page}
              onPageChange={table.handleChangePage}
              onRowsPerPageChange={table.handleChangeRowsPerPage}
            />
          </Box>
        )}
      </Paper>
      {canManageActivities && matrix?.detail && activityFormOpen && (
        <ActivityFormDialog
          open
          saving={creatingActivity}
          activity={null}
          idGradeSchemeDetail={matrix.detail.idGradeSchemeDetail}
          creationNotice='Las actividades sin calificación se consideran con valor 0 en el cálculo del promedio.'
          onClose={() => {
            if (!activityBusy.current) setActivityFormOpen(false);
          }}
          onCreate={create}
          onUpdate={updateActivity}
        />
      )}
      <GradeChangesBar
        count={dirtyCount}
        invalidCount={grades.invalidCount}
        saving={grades.saving}
        disabled={!canEdit}
        onDiscard={() => setConfirm({ kind: 'discard' })}
        onSave={() => void save()}
      />
      <Dialog
        open={!!confirm}
        onClose={() => {
          if (!grades.saving) setConfirm(null);
        }}
        aria-labelledby='discard-grade-title'
      >
        <DialogTitle id='discard-grade-title'>Descartar cambios</DialogTitle>
        <DialogContent>
          <Typography>Se perderán {dirtyCount} calificaciones modificadas que todavía no fueron guardadas.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirm(null)} disabled={grades.saving}>
            Cancelar
          </Button>
          <Button
            color='error'
            onClick={() => {
              grades.discard();
              const target = confirm?.kind === 'leave' ? confirm.target : undefined;

              setConfirm(null);
              if (target) router.push(target);
            }}
            disabled={grades.saving}
          >
            Descartar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
