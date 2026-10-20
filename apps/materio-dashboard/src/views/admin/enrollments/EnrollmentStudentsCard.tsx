'use client';

import { useMemo, useState } from 'react';

import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  InputAdornment,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';

import type { useEnrollmentStudentsPage } from '@/hooks/enrollments/useEnrollmentStudentsPage';
import { PaginationTable, type HeadCell } from '@/components/table';
import { useDataTable } from '@/hooks/table/useDataTable';

import type { IEnrollmentStudent } from '@/interfaces/enrollments/enrollment-student.interface';

import type { IStudentGradeSummary } from '@/interfaces/enrollments/student-grade-summary.interface';
import { StudentGradeCell, type StudentGradesMode } from './StudentGradeCell';
import { DEFAULT_GRADE_DISPLAY_MODE, GradeViewToggle } from './GradeViewToggle';

const studentColumns = [
  { id: 'idEnrollment', label: '#', sortable: true },
] as const satisfies readonly HeadCell<IEnrollmentStudent>[];

interface EnrollmentStudentsCardProps {
  students: IEnrollmentStudent[];
  pagination?: Pick<ReturnType<typeof useEnrollmentStudentsPage>, 'query' | 'meta' | 'changeQuery'>;
  summary?: IStudentGradeSummary | null;
  summaryLoading?: boolean;
  summaryError?: string | null;
  onRetrySummary?: () => void;
  showGrades?: boolean;
  loading: boolean;

  onSelectStudent: (student: IEnrollmentStudent) => void;

  onManageAttendance: () => void;
  onImportStudents?: () => void;
  onManageGrades?: () => void;
}

export function EnrollmentStudentsCard({
  students,
  pagination,
  summary,
  summaryLoading = false,
  summaryError,
  onRetrySummary,
  showGrades = true,
  loading,
  onSelectStudent,
  onManageAttendance,
  onImportStudents,
  onManageGrades,
}: EnrollmentStudentsCardProps) {
  const [mode, setMode] = useState<StudentGradesMode>(DEFAULT_GRADE_DISPLAY_MODE);

  const gradeStudents = useMemo(
    () =>
      new Map(
        summary?.students.map((student) => [
          student.idEnrollment,
          { ...student, byDetail: new Map(student.details.map((detail) => [detail.idGradeSchemeDetail, detail])) },
        ]) ?? [],
      ),
    [summary],
  );

  const details = summary?.scheme?.details ?? [];
  const [search, setSearch] = useState('');

  const filteredStudents = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();

    if (pagination || !query) return students;

    return students.filter((student) => {
      const fullName = `${student.user.name} ${student.user.lastname}`.toLocaleLowerCase();

      const ci = String(student.user.ci ?? '').toLocaleLowerCase();

      const ru = String(student.user.ru ?? '').toLocaleLowerCase();

      return fullName.includes(query) || ci.includes(query) || ru.includes(query);
    });
  }, [students, search, pagination]);

  const table = useDataTable<IEnrollmentStudent, typeof studentColumns>(filteredStudents, 'idEnrollment', 10, {
    preserveOrder: true,
    remote: pagination ? { ...pagination.query, changeQuery: pagination.changeQuery } : undefined,
  });

  const currentPage = table.page;
  const rowsPerPage = table.rowsPerPage;
  const visibleStudents = table.visibleRows;

  const getInitials = (name: string, lastname: string) => `${name?.[0] ?? ''}${lastname?.[0] ?? ''}`.toUpperCase();

  return (
    <Card
      variant='outlined'
      sx={{
        borderRadius: 3,
        borderColor: 'divider',
        boxShadow: 'none',
        overflow: 'hidden',
      }}
    >
      <CardContent
        sx={{
          p: 0,
          '&:last-child': {
            pb: 0,
          },
        }}
      >
        {/* Header */}
        <Stack
          direction={{
            xs: 'column',
            sm: 'row',
          }}
          alignItems={{
            xs: 'stretch',
            sm: 'center',
          }}
          justifyContent='space-between'
          spacing={2}
          sx={{
            px: 3,
            pt: 2.5,
            pb: 2,
          }}
        >
          <Stack direction='row' alignItems='center' spacing={1.5}>
            <Box
              sx={{
                width: 40,
                height: 40,

                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',

                borderRadius: 2,

                bgcolor: 'primary.lighterOpacity',
                color: 'primary.main',
              }}
            >
              <i className='ri-group-line' />
            </Box>

            <Box>
              <Typography variant='h6' fontWeight={600}>
                Estudiantes
              </Typography>

              <Typography variant='body2' color='text.secondary'>
                {pagination?.meta.total ?? students.length}{' '}
                {(pagination?.meta.total ?? students.length) === 1
                  ? 'estudiante matriculado'
                  : 'estudiantes matriculados'}
              </Typography>
            </Box>
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            {onManageGrades && (
              <Button variant='outlined' onClick={onManageGrades} startIcon={<i className='ri-table-line' />}>
                Gestionar calificaciones
              </Button>
            )}
            {onImportStudents && (
              <Button variant='outlined' onClick={onImportStudents} startIcon={<i className='ri-upload-line' />}>
                Importar estudiantes
              </Button>
            )}
            <Button
              variant='contained'
              onClick={onManageAttendance}
              startIcon={<i className='ri-calendar-check-line' />}
            >
              Tomar asistencia
            </Button>
          </Stack>
        </Stack>

        {!showGrades && summaryError && (
          <Alert severity='error' sx={{ mx: 3, mb: 2 }}>
            {summaryError}
          </Alert>
        )}
        {showGrades && summaryError && (
          <Alert severity='error' action={<Button onClick={onRetrySummary}>Reintentar</Button>} sx={{ mx: 3, mb: 2 }}>
            No se pudo cargar el resumen de calificaciones. {summaryError}
          </Alert>
        )}
        {showGrades && !summaryLoading && !summaryError && summary && (!summary.scheme || details.length === 0) && (
          <Alert severity='info' sx={{ mx: 3, mb: 2 }}>
            {summary.scheme
              ? 'El esquema del auxiliar todavía no tiene criterios.'
              : 'Todavía no existe un esquema de calificación del auxiliar.'}
          </Alert>
        )}
        {/* Search */}
        <Box
          sx={{
            px: 3,
            pb: 2,
          }}
        >
          {showGrades && <GradeViewToggle value={mode} onChange={setMode} sx={{ mb: 2 }} />}
          {showGrades && summary?.scheme && (
            <Typography variant='caption' color='text.secondary' sx={{ display: 'block', mb: 2 }}>
              El bloque del auxiliar aporta hasta {summary.scheme.assistantPercentage} puntos.
            </Typography>
          )}
          <TextField
            fullWidth
            size='small'
            value={pagination?.query.search ?? search}
            placeholder='Buscar estudiante por nombre, CI o RU...'
            onChange={(event) => {
              pagination?.changeQuery({ search: event.target.value });
              setSearch(event.target.value);
              if (!pagination) table.handleChangePage(null, 0);
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position='start'>
                  <i className='ri-search-line' />
                </InputAdornment>
              ),
            }}
          />
        </Box>

        {loading ? (
          <Stack
            spacing={1}
            sx={{
              px: 3,
              pb: 3,
            }}
          >
            {Array.from({
              length: 6,
            }).map((_, index) => (
              <Skeleton key={index} variant='rounded' height={48} />
            ))}
          </Stack>
        ) : filteredStudents.length === 0 ? (
          <Box
            sx={{
              py: 7,
              px: 3,
              textAlign: 'center',
            }}
          >
            <Box
              component='i'
              className='ri-user-search-line'
              sx={{
                display: 'block',
                mb: 1,
                fontSize: '2rem',
                color: 'text.disabled',
              }}
            />

            <Typography fontWeight={600}>No se encontraron estudiantes</Typography>

            <Typography variant='body2' color='text.secondary' sx={{ mt: 0.5 }}>
              Intenta con otro nombre, CI o RU.
            </Typography>
          </Box>
        ) : (
          <>
            <TableContainer sx={{ overflowX: 'auto' }}>
              <Table
                size='small'
                sx={{
                  minWidth: 750,
                }}
              >
                <TableHead>
                  <TableRow
                    sx={{
                      bgcolor: 'action.hover',
                    }}
                  >
                    <TableCell
                      sx={{
                        pl: 3,
                        width: 60,
                      }}
                    >
                      #
                    </TableCell>

                    <TableCell sx={{ minWidth: 240 }}>Nombre del estudiante</TableCell>

                    <TableCell>CI</TableCell>

                    <TableCell>RU</TableCell>
                    {showGrades &&
                      details.map((detail) => (
                        <TableCell key={detail.idGradeSchemeDetail} align='right' sx={{ minWidth: 120 }}>
                          <Typography variant='body2' fontWeight={600}>
                            {detail.name}
                          </Typography>
                          <Typography variant='caption' color='text.secondary'>
                            {detail.percentage}%
                          </Typography>
                        </TableCell>
                      ))}
                    {showGrades && (
                      <TableCell align='right' sx={{ minWidth: 120 }}>
                        Total
                      </TableCell>
                    )}

                    <TableCell
                      align='right'
                      sx={{
                        pr: 3,
                        width: 100,
                      }}
                    >
                      Acciones
                    </TableCell>
                  </TableRow>
                </TableHead>

                <TableBody>
                  {visibleStudents.map((student, index) => (
                    <TableRow
                      hover
                      key={student.idEnrollment}
                      onClick={() => onSelectStudent(student)}
                      sx={{
                        cursor: 'pointer',
                      }}
                    >
                      <TableCell sx={{ pl: 3 }}>
                        <Typography variant='body2' color='text.secondary'>
                          {currentPage * rowsPerPage + index + 1}
                        </Typography>
                      </TableCell>

                      <TableCell>
                        <Stack direction='row' alignItems='center' spacing={1.5}>
                          <Avatar
                            sx={{
                              width: 34,
                              height: 34,

                              bgcolor: 'primary.lighterOpacity',

                              color: 'primary.main',

                              fontSize: '0.75rem',

                              fontWeight: 600,
                            }}
                          >
                            {getInitials(student.user.name, student.user.lastname)}
                          </Avatar>

                          <Typography variant='body2' fontWeight={500}>
                            {student.user.name} {student.user.lastname}
                          </Typography>
                        </Stack>
                      </TableCell>

                      <TableCell>
                        <Typography variant='body2'>{student.user.ci || '—'}</Typography>
                      </TableCell>

                      <TableCell>
                        <Typography variant='body2'>{student.user.ru || '—'}</Typography>
                      </TableCell>

                      {showGrades &&
                        details.map((detail) => {
                          const grade = gradeStudents
                            .get(student.idEnrollment)
                            ?.byDetail.get(detail.idGradeSchemeDetail);

                          return (
                            <TableCell key={detail.idGradeSchemeDetail} align='right'>
                              {summaryLoading ? (
                                <Skeleton width={70} />
                              ) : (
                                <StudentGradeCell
                                  score={mode === 'weighted' ? grade?.weightedScore : grade?.rawScore}
                                  maximum={mode === 'weighted' ? detail.maximumScore : undefined}
                                />
                              )}
                            </TableCell>
                          );
                        })}
                      {showGrades && (
                        <TableCell align='right' sx={{ bgcolor: 'action.hover' }}>
                          {summaryLoading ? (
                            <Skeleton width={70} />
                          ) : (
                            <StudentGradeCell
                              total
                              score={
                                mode === 'weighted'
                                  ? gradeStudents.get(student.idEnrollment)?.assistantContribution
                                  : gradeStudents.get(student.idEnrollment)?.totalRaw
                              }
                              maximum={mode === 'weighted' ? summary?.scheme?.assistantPercentage : 100}
                            />
                          )}
                        </TableCell>
                      )}
                      <TableCell
                        align='right'
                        sx={{ pr: 3, position: 'sticky', right: 0, bgcolor: 'background.paper' }}
                      >
                        <Button
                          size='small'
                          endIcon={<i className='ri-arrow-right-s-line' />}
                          onClick={(event) => {
                            event.stopPropagation();

                            onSelectStudent(student);
                          }}
                        >
                          Ver
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            <PaginationTable
              count={pagination?.meta.total ?? filteredStudents.length}
              page={currentPage}
              rowsPerPage={rowsPerPage}
              onPageChange={table.handleChangePage}
              onRowsPerPageChange={table.handleChangeRowsPerPage}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}
