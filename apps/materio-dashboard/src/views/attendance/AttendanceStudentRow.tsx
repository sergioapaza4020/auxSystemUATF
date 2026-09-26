import { Avatar, Box, Stack, TableCell, TableRow, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';

import CheckOutlinedIcon from '@mui/icons-material/CheckOutlined';
import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined';

import type { IEnrollmentStudent } from '@/interfaces/enrollments/enrollment-student.interface';

import { AttendanceStatus } from '@/enums/attendanceStatus';

interface AttendanceStudentRowProps {
  number: number;
  student: IEnrollmentStudent;
  status: AttendanceStatus;

  onChange: (status: AttendanceStatus) => void;
}

export function AttendanceStudentRow({ number, student, status, onChange }: AttendanceStudentRowProps) {
  const initials = `${student.user.name?.charAt(0) ?? ''}${student.user.lastname?.charAt(0) ?? ''}`.toUpperCase();

  return (
    <TableRow
      hover
      sx={{
        '&:last-child td': {
          borderBottom: 0,
        },
      }}
    >
      <TableCell align='center'>
        <Typography variant='body2' color='text.secondary'>
          {String(number).padStart(2, '0')}
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

            <Typography variant='caption' color='text.secondary'>
              {student.user.username}
            </Typography>
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
        <ToggleButtonGroup
          exclusive
          size='small'
          value={status}
          onChange={(_, value: AttendanceStatus | null) => {
            if (value) {
              onChange(value);
            }
          }}
          sx={{
            '& .MuiToggleButton-root': {
              width: 135,
              py: 0.5,
              textTransform: 'none',
            },

            '& .MuiToggleButton-root:first-of-type.Mui-selected': {
              bgcolor: 'success.lighterOpacity',
              color: 'success.main',
              borderColor: 'success.main',

              '&:hover': {
                bgcolor: 'success.lighterOpacity',
              },
            },

            '& .MuiToggleButton-root:last-of-type.Mui-selected': {
              bgcolor: 'error.lighterOpacity',
              color: 'error.main',
              borderColor: 'error.main',

              '&:hover': {
                bgcolor: 'error.lighterOpacity',
              },
            },
          }}
        >
          <ToggleButton value={AttendanceStatus.PRESENT}>
            <CheckOutlinedIcon sx={{ fontSize: 17, mr: 0.75 }} />
            Presente
          </ToggleButton>

          <ToggleButton value={AttendanceStatus.ABSENT}>
            <CloseOutlinedIcon sx={{ fontSize: 17, mr: 0.75 }} />
            Ausente
          </ToggleButton>
        </ToggleButtonGroup>
      </TableCell>
    </TableRow>
  );
}
