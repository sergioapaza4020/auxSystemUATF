import {
  Box,
  Card,
  CircularProgress,
  IconButton,
  LinearProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';

import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import MoreVertOutlinedIcon from '@mui/icons-material/MoreVertOutlined';

interface AttendanceSession {
  idAttendanceSession: number;
  date: string;
  presentCount: number;
  absentCount: number;
}

interface AttendanceHistoryProps {
  sessions: AttendanceSession[];
  loading: boolean;

  selectedSessionId: number | null;

  onSelectSession: (idSession: number) => void;
}

export function AttendanceHistory({ sessions, loading, selectedSessionId, onSelectSession }: AttendanceHistoryProps) {
  const formatDate = (date: string) => {
    const [year, month, day] = date.slice(0, 10).split('-');

    return `${day}/${month}/${year}`;
  };

  return (
    <Card>
      <Box sx={{ px: 3, pt: 2.5 }}>
        <Typography variant='h6' fontWeight={700}>
          Historial de asistencia
        </Typography>

        <Typography variant='body2' color='text.secondary'>
          Sesiones registradas en esta materia.
        </Typography>
      </Box>

      <Box sx={{ p: 2 }}>
        {loading ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <CircularProgress size={24} />
          </Box>
        ) : sessions.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography color='text.secondary'>No existen sesiones de asistencia.</Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table size='small'>
              <TableHead>
                <TableRow>
                  <TableCell>Fecha</TableCell>

                  <TableCell>Presentes</TableCell>

                  <TableCell>Ausentes</TableCell>

                  <TableCell sx={{ width: 300 }}>Asistencia</TableCell>

                  <TableCell align='right'>Acciones</TableCell>
                </TableRow>
              </TableHead>

              <TableBody>
                {sessions.map((item) => {
                  const total = item.presentCount + item.absentCount;

                  const percentage = total > 0 ? (item.presentCount / total) * 100 : 0;

                  const selected = selectedSessionId === item.idAttendanceSession;

                  return (
                    <TableRow key={item.idAttendanceSession} hover selected={selected}>
                      <TableCell>
                        <Typography variant='body2' fontWeight={selected ? 600 : 400}>
                          {formatDate(item.date)}
                        </Typography>
                      </TableCell>

                      <TableCell>
                        <StatusCount value={item.presentCount} color='success.main' />
                      </TableCell>

                      <TableCell>
                        <StatusCount value={item.absentCount} color='error.main' />
                      </TableCell>

                      <TableCell>
                        <Stack direction='row' spacing={1.5} alignItems='center'>
                          <LinearProgress
                            variant='determinate'
                            value={percentage}
                            sx={{
                              width: 170,
                              height: 7,
                              borderRadius: 10,
                            }}
                          />

                          <Typography variant='body2' sx={{ minWidth: 50 }}>
                            {percentage.toFixed(1)}%
                          </Typography>
                        </Stack>
                      </TableCell>

                      <TableCell align='right'>
                        <Tooltip title='Abrir sesión'>
                          <IconButton size='small' onClick={() => onSelectSession(item.idAttendanceSession)}>
                            <VisibilityOutlinedIcon fontSize='small' />
                          </IconButton>
                        </Tooltip>

                        {/*
                          Lo conectaremos cuando tengamos
                          endpoints/permisos para editar fecha
                          y eliminar sesión.
                        */}
                        <IconButton size='small' disabled>
                          <MoreVertOutlinedIcon fontSize='small' />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>
    </Card>
  );
}

interface StatusCountProps {
  value: number;
  color: string;
}

function StatusCount({ value, color }: StatusCountProps) {
  return (
    <Stack direction='row' spacing={1} alignItems='center'>
      <Box
        sx={{
          width: 9,
          height: 9,
          borderRadius: '50%',
          bgcolor: color,
        }}
      />

      <Typography variant='body2'>{value}</Typography>
    </Stack>
  );
}
