'use client';

import { useMemo, useState } from 'react';

import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  InputAdornment,
  MenuItem,
  Select,
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

import type { IEnrollmentStudent } from '@/interfaces/enrollments/enrollment-student.interface';

interface EnrollmentStudentsCardProps {
  students: IEnrollmentStudent[];
  loading: boolean;

  onSelectStudent: (student: IEnrollmentStudent) => void;

  onManageAttendance: () => void;
  onImportStudents?: () => void;
}

export function EnrollmentStudentsCard({
  students,
  loading,
  onSelectStudent,
  onManageAttendance,
  onImportStudents,
}: EnrollmentStudentsCardProps) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const filteredStudents = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();

    if (!query) return students;

    return students.filter((student) => {
      const fullName = `${student.user.name} ${student.user.lastname}`.toLocaleLowerCase();

      const ci = String(student.user.ci ?? '').toLocaleLowerCase();

      const ru = String(student.user.ru ?? '').toLocaleLowerCase();

      return fullName.includes(query) || ci.includes(query) || ru.includes(query);
    });
  }, [students, search]);

  const visibleStudents = useMemo(() => {
    const start = page * rowsPerPage;

    return filteredStudents.slice(start, start + rowsPerPage);
  }, [filteredStudents, page, rowsPerPage]);

  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / rowsPerPage));

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
                {students.length} {students.length === 1 ? 'estudiante matriculado' : 'estudiantes matriculados'}
              </Typography>
            </Box>
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
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

        {/* Search */}
        <Box
          sx={{
            px: 3,
            pb: 2,
          }}
        >
          <TextField
            fullWidth
            size='small'
            value={search}
            placeholder='Buscar estudiante por nombre, CI o RU...'
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(0);
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
            <TableContainer>
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

                    <TableCell>Nombre del estudiante</TableCell>

                    <TableCell>CI</TableCell>

                    <TableCell>RU</TableCell>

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
                          {page * rowsPerPage + index + 1}
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

                      <TableCell align='right' sx={{ pr: 3 }}>
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

            {/* Pagination */}
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
                py: 2,

                borderTop: (theme) => `1px solid ${theme.palette.divider}`,
              }}
            >
              <Typography variant='body2' color='text.secondary'>
                Mostrando {page * rowsPerPage + 1}-{Math.min((page + 1) * rowsPerPage, filteredStudents.length)} de{' '}
                {filteredStudents.length}
              </Typography>

              <Stack direction='row' alignItems='center' justifyContent='flex-end' spacing={1}>
                <Typography variant='body2' color='text.secondary'>
                  Filas:
                </Typography>

                <Select
                  size='small'
                  value={rowsPerPage}
                  onChange={(event) => {
                    setRowsPerPage(Number(event.target.value));

                    setPage(0);
                  }}
                  sx={{
                    minWidth: 70,
                  }}
                >
                  {[5, 10, 25].map((value) => (
                    <MenuItem key={value} value={value}>
                      {value}
                    </MenuItem>
                  ))}
                </Select>

                <Button
                  size='small'
                  disabled={page === 0}
                  onClick={() => setPage((current) => Math.max(current - 1, 0))}
                  sx={{
                    minWidth: 36,
                  }}
                >
                  <i className='ri-arrow-left-s-line' />
                </Button>

                <Typography
                  variant='body2'
                  sx={{
                    minWidth: 45,
                    textAlign: 'center',
                  }}
                >
                  {page + 1}/{totalPages}
                </Typography>

                <Button
                  size='small'
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((current) => Math.min(current + 1, totalPages - 1))}
                  sx={{
                    minWidth: 36,
                  }}
                >
                  <i className='ri-arrow-right-s-line' />
                </Button>
              </Stack>
            </Stack>
          </>
        )}
      </CardContent>
    </Card>
  );
}
