import { Box, Button, Card, CardContent, Stack, TextField, Typography } from '@mui/material';

import AddCircleOutlineOutlinedIcon from '@mui/icons-material/AddCircleOutlineOutlined';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';

interface AttendanceSessionToolbarProps {
  selectedDate: string;
  selectedSessionId: number | null;
  session: {
    date?: string;
  } | null;

  saving: boolean;

  onDateChange: (date: string) => void;
  onCreateSession: () => void;
}

export function AttendanceSessionToolbar({
  selectedDate,
  selectedSessionId,
  session,
  saving,
  onDateChange,
  onCreateSession,
}: AttendanceSessionToolbarProps) {
  const formatDate = (date: string) => {
    const cleanDate = date.slice(0, 10);
    const [year, month, day] = cleanDate.split('-');

    return `${day}/${month}/${year}`;
  };

  return (
    <Card>
      <CardContent sx={{ py: 2.5 }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          alignItems={{ xs: 'stretch', md: 'center' }}
          justifyContent='space-between'
          spacing={2}
        >
          <Stack direction='row' spacing={1.5} alignItems='center'>
            <Box
              sx={{
                width: 42,
                height: 42,
                borderRadius: 2,
                bgcolor: 'primary.lighterOpacity',
                color: 'primary.main',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CalendarMonthOutlinedIcon />
            </Box>

            <Typography fontWeight={600}>Sesión de asistencia</Typography>
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'stretch', sm: 'center' }}>
            <TextField
              label='Fecha'
              type='date'
              size='small'
              value={selectedDate}
              onChange={(event) => onDateChange(event.target.value)}
              InputLabelProps={{
                shrink: true,
              }}
              sx={{ width: { xs: '100%', sm: 190 } }}
            />

            {selectedSessionId && session?.date && (
              <Stack
                direction='row'
                spacing={1}
                alignItems='center'
                sx={{
                  px: 2,
                  py: 1,
                  borderRadius: 2,
                  bgcolor: 'success.lighterOpacity',
                  color: 'success.main',
                }}
              >
                <CheckCircleOutlinedIcon fontSize='small' />

                <Box>
                  <Typography variant='body2' fontWeight={600}>
                    Editando asistencia
                  </Typography>

                  <Typography variant='caption'>del {formatDate(session.date)}</Typography>
                </Box>
              </Stack>
            )}

            <Button
              variant='outlined'
              startIcon={<AddCircleOutlineOutlinedIcon />}
              disabled={saving || !selectedDate}
              onClick={onCreateSession}
            >
              Nueva sesión
            </Button>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
