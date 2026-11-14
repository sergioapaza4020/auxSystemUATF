import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Alert, Button, Container, FormControlLabel, Stack, Switch, TextField, Typography } from '@mui/material';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { StudentAttendanceRegistration } from '../../src/views/attendance/StudentAttendanceCheckIn';
import { AttendanceGeolocationDialog } from '../../src/views/attendance/AttendanceGeolocationDialog';
import { owner, reset, scenario } from './services';

const fakeLocation = {
  getCurrentPosition: (accept: PositionCallback, reject: PositionErrorCallback) => {
    const code =
      scenario === 'GPS_DENIED' ? 1 : scenario === 'GPS_UNAVAILABLE' ? 2 : scenario === 'GPS_TIMEOUT' ? 3 : 0;

    if (code) reject({ code } as GeolocationPositionError);
    else accept({ coords: { latitude: -17, longitude: -65, accuracy: 18 } } as GeolocationPosition);
  },
};
Object.defineProperty(navigator, 'geolocation', { configurable: true, value: fakeLocation });
function Preview() {
  const [revision, setRevision] = useState(0);
  const [dialog, setDialog] = useState(false);
  const [message, setMessage] = useState('');
  const [dark, setDark] = useState(false);
  const [, refresh] = useState(0);

  useEffect(() => {
    const receive = (event: Event) => setMessage(String((event as CustomEvent<unknown>).detail));

    window.addEventListener('attendance-fixture-message', receive);
    return () => window.removeEventListener('attendance-fixture-message', receive);
  }, []);
  return (
    <ThemeProvider theme={createTheme({ palette: { mode: dark ? 'dark' : 'light' } })}>
      <Container sx={{ py: 3, bgcolor: 'background.default', color: 'text.primary', minHeight: '100vh' }}>
        <Stack spacing={2}>
          <Alert severity='warning'>SIMULACIÓN LOCAL · Datos ficticios · Sin base de aplicación ni GPS real</Alert>
          <Typography variant='h5'>Validación visual de Attendance</Typography>
          <FormControlLabel
            control={<Switch checked={dark} onChange={(_, value) => setDark(value)} />}
            label='Modo oscuro de prueba'
          />
          <TextField
            select
            SelectProps={{ native: true }}
            InputLabelProps={{ shrink: true }}
            label='Escenario simulado'
            value={scenario}
            onChange={(event) => {
              reset(event.target.value);
              setRevision((value) => value + 1);
              setMessage('');
              Object.defineProperty(navigator, 'geolocation', {
                configurable: true,
                value: event.target.value === 'GPS_UNSUPPORTED' ? undefined : fakeLocation,
              });
            }}
          >
            {[
              'SUCCESS',
              'SCHEDULED',
              'EMPTY',
              'OUTSIDE_AREA',
              'LOW_ACCURACY',
              'ALREADY_REGISTERED',
              'SESSION_NOT_STARTED',
              'SESSION_CLOSED',
              'SESSION_CANCELLED',
              'NOT_ENROLLED',
              'LOCATION_INVALID',
              'SESSION_CONTEXT_INVALID',
              'GPS_DENIED',
              'GPS_UNAVAILABLE',
              'GPS_TIMEOUT',
              'GPS_UNSUPPORTED',
              'NETWORK_CONFIRMED',
              'NETWORK_UNKNOWN',
              '401',
              '403',
              '429',
              '500',
            ].map((value) => (
              <option value={value} key={value}>
                {value}
              </option>
            ))}
          </TextField>
          <Button variant='outlined' onClick={() => setDialog(true)}>
            Configurar GEO ficticia
          </Button>
          {message && <Alert severity='info'>{message}</Alert>}
          <StudentAttendanceRegistration key={revision} idEnrollment={700} onAcademicRefresh={() => undefined} />
        </Stack>
        {dialog && (
          <AttendanceGeolocationDialog
            session={owner}
            canUpdate
            onClose={() => setDialog(false)}
            onRefresh={async () => {
              refresh((value) => value + 1);
            }}
          />
        )}
      </Container>
    </ThemeProvider>
  );
}
createRoot(document.getElementById('root')!).render(<Preview />);
