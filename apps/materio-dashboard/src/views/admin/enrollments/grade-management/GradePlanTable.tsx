import { useEffect, useRef } from 'react';

import { weightedScore } from '@repo/grade-calculations';

import {
  Avatar,
  Box,
  LinearProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';

import type { IGradeMatrix } from '@/interfaces/grades/grade-matrix.interface';
import { DEFAULT_GRADE_DISPLAY_MODE, type GradeDisplayMode } from '../GradeViewToggle';
import {
  gradeCellKey,
  parseGradeDraft,
  studentCriterionResult,
  type GradeDrafts,
  type GradeOriginals,
} from '@/hooks/grades/grade-matrix-state';

export interface GradePlanTableProps {
  displayMode?: GradeDisplayMode;
  percentage?: number;
  assistantPercentage?: number;
  students: IGradeMatrix['students'];
  activities: IGradeMatrix['activities'];
  resultActivityIds: number[];
  originals: GradeOriginals;
  drafts: GradeDrafts;
  firstRow: number;
  disabled: boolean;
  pendingFocus: string | null;
  onFocusHandled: () => void;
  onEdit: (key: string, value: string) => void;
  onMove: (enrollmentId: number, activityId: number, direction: 1 | -1) => void;
}

export function formatGradeDeadline(date: string): string {
  const [year, month, day] = date.split('-').map(Number);

  return new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(year, month - 1, day)),
  );
}

export function GradePlanTable(props: GradePlanTableProps) {
  const {
    students,
    activities,
    resultActivityIds,
    originals,
    drafts,
    firstRow,
    disabled,
    onEdit,
    onMove,
    pendingFocus,
    onFocusHandled,
    displayMode = DEFAULT_GRADE_DISPLAY_MODE,
    percentage = 100,
    assistantPercentage = 100,
  } = props;

  const inputs = useRef(new Map<string, HTMLInputElement>());
  const maximum = displayMode === 'weighted' ? (weightedScore(100, percentage, assistantPercentage / 100) ?? 0) : 100;

  useEffect(() => {
    if (!pendingFocus) return;

    const input = inputs.current.get(pendingFocus);

    if (input) {
      input.focus();
      input.select();
      onFocusHandled();
    }
  }, [pendingFocus, onFocusHandled, students]);

  return (
    <TableContainer sx={{ overflowX: 'auto', maxHeight: '65vh' }}>
      <Table stickyHeader size='small' aria-label='Planilla de calificaciones' sx={{ minWidth: 800 }}>
        <TableHead>
          <TableRow>
            <TableCell sx={{ width: 44 }}>#</TableCell>
            <TableCell sx={{ position: 'sticky', left: 0, zIndex: 4, minWidth: 240, bgcolor: 'background.paper' }}>
              Estudiante
            </TableCell>
            <TableCell sx={{ minWidth: 100, display: { xs: 'none', sm: 'table-cell' } }}>CI</TableCell>
            <TableCell sx={{ minWidth: 100, display: { xs: 'none', sm: 'table-cell' } }}>RU</TableCell>
            {activities.map((activity) => (
              <TableCell key={activity.idActivity} align='center' sx={{ minWidth: 156, bgcolor: 'background.default' }}>
                <Tooltip
                  title={
                    <Box>
                      {activity.description && <div>{activity.description}</div>}
                      {activity.publicationDate && (
                        <div>Publicación: {formatGradeDeadline(activity.publicationDate)}</div>
                      )}
                      <div>Fecha límite: {formatGradeDeadline(activity.dueDate)}</div>
                    </Box>
                  }
                >
                  <Stack spacing={0.3} alignItems='center'>
                    <Typography variant='body2' fontWeight={600}>
                      {activity.name}
                    </Typography>
                    <Typography variant='caption' color='text.secondary'>
                      <i className='ri-calendar-line' /> {formatGradeDeadline(activity.dueDate)}
                    </Typography>
                    <Typography variant='caption' color='text.disabled'>
                      / 100
                    </Typography>
                  </Stack>
                </Tooltip>
              </TableCell>
            ))}
            <TableCell align='center' sx={{ minWidth: 200, bgcolor: 'background.default' }}>
              <Typography variant='body2' fontWeight={700}>
                Resultado
              </Typography>
              <Typography variant='caption' color='text.secondary'>
                {displayMode === 'weighted' ? 'Aporte del criterio' : 'Promedio del criterio'} / {maximum}
              </Typography>
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {students.map((student, index) => {
            const fullName = `${student.name} ${student.lastname}`;
            const rawResult = studentCriterionResult(student.idEnrollment, resultActivityIds, originals, drafts);

            const result =
              displayMode === 'weighted' ? weightedScore(rawResult, percentage, assistantPercentage / 100) : rawResult;

            return (
              <TableRow hover key={student.idEnrollment}>
                <TableCell>
                  <Typography variant='body2' color='text.secondary'>
                    {firstRow + index + 1}
                  </Typography>
                </TableCell>
                <TableCell sx={{ position: 'sticky', left: 0, zIndex: 2, bgcolor: 'background.paper', minWidth: 240 }}>
                  <Tooltip title={`${fullName} · CI: ${student.ci ?? '--'} · RU: ${student.ru ?? '--'}`}>
                    <Stack direction='row' spacing={1.5} alignItems='center'>
                      <Avatar
                        sx={{
                          width: 34,
                          height: 34,
                          bgcolor: 'primary.lighterOpacity',
                          color: 'primary.main',
                          fontSize: 13,
                        }}
                      >
                        {`${student.name[0] ?? ''}${student.lastname[0] ?? ''}`.toUpperCase()}
                      </Avatar>
                      <Typography variant='body2'>{fullName}</Typography>
                    </Stack>
                  </Tooltip>
                </TableCell>
                <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                  <Typography variant='body2' color='text.secondary'>
                    {student.ci ?? '--'}
                  </Typography>
                </TableCell>
                <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                  <Typography variant='body2' color='text.secondary'>
                    {student.ru ?? '--'}
                  </Typography>
                </TableCell>
                {activities.map((activity) => {
                  const key = gradeCellKey(student.idEnrollment, activity.idActivity);
                  const original = originals[key] ?? null;
                  const value = drafts[key] ?? (original === null ? '' : String(original));
                  const parsed = parseGradeDraft(value, original);
                  const dirty = parsed.error !== null || parsed.score !== original;
                  const errorId = `grade-error-${student.idEnrollment}-${activity.idActivity}`;

                  return (
                    <TableCell key={activity.idActivity} align='center' sx={{ py: 1 }}>
                      <TextField
                        size='small'
                        value={value}
                        placeholder='--'
                        disabled={disabled}
                        error={!!parsed.error}
                        inputRef={(input: HTMLInputElement | null) => {
                          if (input) inputs.current.set(key, input);
                          else inputs.current.delete(key);
                        }}
                        onChange={(event) => onEdit(key, event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                            if (event.nativeEvent.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
                            event.preventDefault();
                            onMove(student.idEnrollment, activity.idActivity, event.key === 'ArrowUp' ? -1 : 1);
                          }
                        }}
                        inputProps={{
                          'aria-label': `Calificación de ${fullName} en ${activity.name}${dirty ? ', modificada sin guardar' : ''}`,
                          'aria-describedby': parsed.error ? errorId : undefined,
                          'aria-invalid': !!parsed.error,
                          inputMode: 'decimal',
                          autoComplete: 'off',
                        }}
                        FormHelperTextProps={{ id: errorId }}
                        helperText={parsed.error ?? undefined}
                        InputProps={{
                          endAdornment: dirty ? (
                            <Typography component='span' variant='caption' color='primary.main' aria-hidden>
                              •
                            </Typography>
                          ) : undefined,
                        }}
                        sx={{
                          width: 124,
                          '& input': { textAlign: 'center', py: 1, px: 1 },
                          '& .MuiOutlinedInput-root': { bgcolor: dirty ? 'action.selected' : 'background.paper' },
                          '& .MuiFormHelperText-root': { mx: 0, maxWidth: 124 },
                        }}
                      />
                    </TableCell>
                  );
                })}
                <TableCell sx={{ bgcolor: 'action.hover' }}>
                  <Stack direction='row' spacing={1} alignItems='center' aria-label={`Resultado de ${fullName}`}>
                    <Typography
                      variant='body2'
                      fontWeight={700}
                      sx={{ minWidth: 40, fontVariantNumeric: 'tabular-nums' }}
                    >
                      {result === null ? '--' : result.toFixed(1)}
                    </Typography>
                    {result !== null && (
                      <LinearProgress
                        variant='determinate'
                        value={maximum === 0 ? 0 : (rawResult ?? 0)}
                        color={(rawResult ?? 0) >= 80 ? 'success' : (rawResult ?? 0) < 60 ? 'warning' : 'primary'}
                        sx={{ width: 86, height: 6, borderRadius: 4 }}
                        aria-label={`Resultado ${result.toFixed(1)} sobre ${maximum}`}
                      />
                    )}
                    <Typography variant='caption' color='text.secondary'>
                      / {maximum}
                    </Typography>
                  </Stack>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
