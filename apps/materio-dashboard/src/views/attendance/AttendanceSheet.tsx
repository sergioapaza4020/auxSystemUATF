import {
  Box,
  Button,
  Card,
  CircularProgress,
  InputAdornment,
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

import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import CheckOutlinedIcon from '@mui/icons-material/CheckOutlined';
import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';

import type { IEnrollmentStudent } from '@/interfaces/enrollments/enrollment-student.interface';

import { AttendanceStatus } from '@/enums/attendanceStatus';

import { AttendanceStudentRow } from './AttendanceStudentRow';

interface AttendanceSheetProps {
  students: IEnrollmentStudent[];
  totalStudents: number;

  attendance: Record<number, AttendanceStatus>;

  loading: boolean;
  saving: boolean;

  search: string;

  presentCount: number;
  absentCount: number;

  hasChanges: boolean;

  onSearchChange: (value: string) => void;

  onChangeAttendance: (idEnrollment: number, status: AttendanceStatus) => void;

  onMarkAllPresent: () => void;
  onMarkAllAbsent: () => void;

  onCancelChanges: () => void;
  onSave: () => void;
}

export function AttendanceSheet({
  students,
  totalStudents,
  attendance,
  loading,
  saving,
  search,
  presentCount,
  absentCount,
  hasChanges,
  onSearchChange,
  onChangeAttendance,
  onMarkAllPresent,
  onMarkAllAbsent,
  onCancelChanges,
  onSave,
}: AttendanceSheetProps) {
  return (
    <Card>
      {/* CABECERA */}
      <Box sx={{ px: 3, pt: 2.5, pb: 2 }}>
        <Typography variant='h6' fontWeight={700}>
          Lista de estudiantes
        </Typography>

        <Typography variant='body2' color='text.secondary'>
          Marca la asistencia de los estudiantes para la sesión seleccionada.
        </Typography>
      </Box>

      {/* TOOLBAR */}
      <Box
        sx={{
          px: 2,
          pb: 1.5,
        }}
      >
        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.5} justifyContent='space-between'>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <TextField
              size='small'
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder='Buscar estudiante por nombre, CI o RU...'
              sx={{
                width: {
                  xs: '100%',
                  sm: 390,
                },
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position='start'>
                    <SearchOutlinedIcon fontSize='small' />
                  </InputAdornment>
                ),
              }}
            />

            <Button
              size='small'
              variant='outlined'
              color='success'
              startIcon={<CheckOutlinedIcon />}
              onClick={onMarkAllPresent}
            >
              Marcar todos presentes
            </Button>

            <Button
              size='small'
              variant='outlined'
              color='error'
              startIcon={<CloseOutlinedIcon />}
              onClick={onMarkAllAbsent}
            >
              Marcar todos ausentes
            </Button>
          </Stack>

          <Stack
            direction='row'
            spacing={2.5}
            alignItems='center'
            sx={{
              px: 1,
              whiteSpace: 'nowrap',
            }}
          >
            <CountIndicator value={totalStudents} label='estudiantes' />

            <CountIndicator value={presentCount} label='presentes' color='success.main' />

            <CountIndicator value={absentCount} label='ausentes' color='error.main' />
          </Stack>
        </Stack>
      </Box>

      {/* PLANILLA */}
      {loading ? (
        <Box
          sx={{
            height: 350,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <CircularProgress size={30} />
        </Box>
      ) : (
        <TableContainer
          sx={{
            maxHeight: 480,
            borderTop: 1,
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          <Table
            stickyHeader
            size='small'
            sx={{
              '& .MuiTableCell-root': {
                py: 1,
              },
            }}
          >
            <TableHead>
              <TableRow>
                <TableCell align='center' sx={{ width: 70 }}>
                  N°
                </TableCell>

                <TableCell>Estudiante</TableCell>

                <TableCell sx={{ width: 240 }}>CI / RU</TableCell>

                <TableCell sx={{ width: 310 }}>Asistencia</TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {students.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} align='center' sx={{ py: 6 }}>
                    <Typography color='text.secondary'>No se encontraron estudiantes.</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                students.map((student, index) => (
                  <AttendanceStudentRow
                    key={student.idEnrollment}
                    number={index + 1}
                    student={student}
                    status={attendance[student.idEnrollment] ?? AttendanceStatus.ABSENT}
                    onChange={(status) => onChangeAttendance(student.idEnrollment, status)}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* FOOTER STICKY */}
      <Box
        sx={{
          px: 2.5,
          py: 1.5,
          bgcolor: 'background.paper',
        }}
      >
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          justifyContent='space-between'
          alignItems={{ xs: 'stretch', md: 'center' }}
          spacing={2}
        >
          <Stack direction='row' spacing={2.5} alignItems='center'>
            <CountIndicator value={presentCount} label='presentes' color='success.main' />

            <CountIndicator value={absentCount} label='ausentes' color='error.main' />

            <Typography variant='body2' color='text.secondary'>
              {totalStudents} estudiantes
            </Typography>
          </Stack>

          <Stack direction='row' spacing={1.5} justifyContent='flex-end' alignItems='center'>
            {hasChanges && (
              <Stack direction='row' spacing={0.75} alignItems='center'>
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    bgcolor: 'warning.main',
                  }}
                />

                <Typography variant='caption' color='warning.main'>
                  Cambios sin guardar
                </Typography>
              </Stack>
            )}

            <Button variant='outlined' disabled={!hasChanges || saving} onClick={onCancelChanges}>
              Cancelar cambios
            </Button>

            <Button
              variant='contained'
              startIcon={saving ? <CircularProgress size={16} color='inherit' /> : <SaveOutlinedIcon />}
              disabled={!hasChanges || saving || totalStudents === 0}
              onClick={onSave}
            >
              {saving ? 'Guardando...' : 'Guardar asistencia'}
            </Button>
          </Stack>
        </Stack>
      </Box>
    </Card>
  );
}

interface CountIndicatorProps {
  value: number;
  label: string;
  color?: string;
}

function CountIndicator({ value, label, color }: CountIndicatorProps) {
  return (
    <Stack direction='row' spacing={0.75} alignItems='center'>
      {color && (
        <Box
          sx={{
            width: 9,
            height: 9,
            borderRadius: '50%',
            bgcolor: color,
          }}
        />
      )}

      <Typography variant='body2'>
        <strong>{value}</strong> {label}
      </Typography>
    </Stack>
  );
}
