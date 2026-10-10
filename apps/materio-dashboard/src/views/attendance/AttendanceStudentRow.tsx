import {
  Avatar,
  Badge,
  Box,
  IconButton,
  Stack,
  Tooltip,
  TableCell,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';

import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined';

import CheckOutlinedIcon from '@mui/icons-material/CheckOutlined';
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';
import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined';

import type { IEnrollmentStudent } from '@/interfaces/enrollments/enrollment-student.interface';

import { attendanceSelectedSx } from '@/utils/attendance-status';
import { AttendanceStatus } from '@/enums/attendanceStatus';

interface AttendanceStudentRowProps {
  number: number;
  student: IEnrollmentStudent;
  status: AttendanceStatus;

  observation?: string | null;
  onEditObservation?: () => void;
  modified?: boolean;
  disabled?: boolean;
  onChange: (status: AttendanceStatus) => void;
}

export function AttendanceStudentRow({
  number,
  student,
  status,
  observation,
  onEditObservation,
  modified = false,
  disabled = false,
  onChange,
}: AttendanceStudentRowProps) {
  const initials = `${student.user.name?.charAt(0) ?? ''}${student.user.lastname?.charAt(0) ?? ''}`.toUpperCase();

  const studentName = `${student.user.name} ${student.user.lastname}`;

  return (
    <TableRow
      hover
      aria-label={modified ? `${studentName}, asistencia modificada sin guardar` : undefined}
      sx={{
        bgcolor: modified ? 'action.hover' : undefined,
        '& > td:first-of-type': { borderLeft: 2, borderLeftColor: modified ? 'warning.main' : 'transparent' },
        '&:last-child td': {
          borderBottom: 0,
        },
      }}
    >
      <TableCell align='center'>
        <Typography variant='body2' color='text.secondary'>
          <Badge variant='dot' color='warning' invisible={!modified} sx={{ '& .MuiBadge-badge': { right: -4 } }}>
            {String(number).padStart(2, '0')}
          </Badge>
        </Typography>
      </TableCell>

      <TableCell>
        <Stack direction='row' spacing={1.5} alignItems='center'>
          <Avatar
            sx={{
              width: 32,
              height: 32,
              fontSize: '0.75rem',
              bgcolor: 'primary.lighterOpacity',
              color: 'primary.main',
            }}
          >
            {initials}
          </Avatar>

          <Box sx={{ minWidth: 0 }}>
            <Typography variant='body2' fontWeight={600} noWrap>
              {student.user.name} {student.user.lastname}
            </Typography>

            {modified && (
              <Typography variant='caption' color='text.secondary'>
                Modificado · sin guardar
              </Typography>
            )}
          </Box>
        </Stack>
      </TableCell>

      <TableCell>
        <Typography variant='body2'>{student.user.ci || '—'}</Typography>

        <Typography variant='caption' color='text.secondary'>
          RU: {student.user.ru || '—'}
        </Typography>
      </TableCell>

      <TableCell>
        <Stack direction='row' spacing={1} alignItems='center'>
          <ToggleButtonGroup
            exclusive
            disabled={disabled}
            aria-label={`Asistencia de ${studentName}`}
            size='small'
            value={status}
            onChange={(_, value: AttendanceStatus | null) => {
              if (value) {
                onChange(value);
              }
            }}
            sx={{
              '& .MuiToggleButton-root': {
                minWidth: 96,
                px: 1,
                '&.Mui-focusVisible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
                py: 0.5,
                textTransform: 'none',
              },
            }}
          >
            <ToggleButton
              value={AttendanceStatus.PRESENT}
              sx={attendanceSelectedSx(AttendanceStatus.PRESENT)}
              aria-label={`Marcar a ${studentName} como presente`}
            >
              <CheckOutlinedIcon sx={{ fontSize: 17, mr: 0.75, color: 'inherit' }} />
              Presente
            </ToggleButton>

            <ToggleButton
              value={AttendanceStatus.EXCUSED}
              sx={attendanceSelectedSx(AttendanceStatus.EXCUSED)}
              aria-label={`Marcar a ${studentName} con permiso`}
            >
              <ScheduleOutlinedIcon sx={{ fontSize: 17, mr: 0.75, color: 'inherit' }} />
              Permiso
            </ToggleButton>

            <ToggleButton
              value={AttendanceStatus.ABSENT}
              sx={attendanceSelectedSx(AttendanceStatus.ABSENT)}
              aria-label={`Marcar a ${studentName} como ausente`}
            >
              <CloseOutlinedIcon sx={{ fontSize: 17, mr: 0.75, color: 'inherit' }} />
              Ausente
            </ToggleButton>
          </ToggleButtonGroup>
          {onEditObservation && status === AttendanceStatus.EXCUSED && (
            <Tooltip title={observation || 'Agregar observación'}>
              <span>
                <IconButton
                  size='small'
                  disabled={disabled}
                  onClick={onEditObservation}
                  aria-label={`${observation ? 'Editar' : 'Agregar'} observación de ${studentName}`}
                  sx={{ color: observation || status === AttendanceStatus.EXCUSED ? 'warning.main' : 'text.secondary' }}
                >
                  <Box sx={{ display: 'flex' }}>
                    <EditNoteOutlinedIcon fontSize='small' />
                  </Box>
                </IconButton>
              </span>
            </Tooltip>
          )}
        </Stack>
        {onEditObservation && status === AttendanceStatus.EXCUSED && !observation && (
          <Typography variant='caption' color='text.secondary'>
            Observación opcional
          </Typography>
        )}
      </TableCell>
    </TableRow>
  );
}
