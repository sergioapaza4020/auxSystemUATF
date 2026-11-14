import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Alert, Button, Stack, Switch, FormControlLabel, Typography, Box } from '@mui/material';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { StudentQrAttendance } from '../../src/views/attendance/StudentQrAttendance';
import { AttendanceQrConfigDialog } from '../../src/views/attendance/AttendanceQrConfigDialog';
import { reset, session, syntheticToken, writes } from './fixtures';
function Preview() {
  const [revision, setRevision] = useState(0);
  const [owner, setOwner] = useState(false);
  const [dark, setDark] = useState(false);
  const [count, setCount] = useState(0);
  const [narrow, setNarrow] = useState(false);
  const show = (auxiliary: boolean, scenario = 'SUCCESS') => {
    reset(auxiliary ? 'DRAFT' : 'OPEN', scenario);
    window.location.hash = `t=${syntheticToken}`;
    setCount(0);
    setOwner(auxiliary);
    setRevision((n) => n + 1);
  };
  useEffect(() => {
    const update = () => setCount(writes);
    window.addEventListener('qr-fixture-write', update);
    return () => window.removeEventListener('qr-fixture-write', update);
  }, []);
  return (
    <ThemeProvider theme={createTheme({ palette: { mode: dark ? 'dark' : 'light' } })}>
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', color: 'text.primary', p: 2 }}>
        <Alert severity='warning'>
          SIMULACIÓN VISUAL LOCAL · Datos ficticios · API y autenticación simuladas · Sin BD ni GPS
        </Alert>
        <Stack direction='row' spacing={1} flexWrap='wrap'>
          <Button onClick={() => show(false)}>Estudiante</Button>
          <Button onClick={() => show(true)}>Auxiliar</Button>
          <Button onClick={() => show(false, 'EXPIRED')}>Código vencido</Button>
          <Button onClick={() => show(false, 'UNCERTAIN')}>Respuesta perdida</Button>
          <FormControlLabel control={<Switch checked={dark} onChange={(_, v) => setDark(v)} />} label='Tema oscuro' />
          <FormControlLabel
            control={<Switch checked={narrow} onChange={(_, v) => setNarrow(v)} />}
            label='Contenedor 360 px'
          />
        </Stack>
        <Typography>POST simulados: {count}</Typography>
        <Box sx={{ maxWidth: narrow ? 360 : undefined, mx: 'auto' }}>
          <StudentQrAttendance key={revision} />
        </Box>
        {owner && (
          <AttendanceQrConfigDialog
            key={revision}
            session={session}
            course='Materia ficticia · Grupo 1'
            canUpdate
            canGetQr
            canDelete
            onClose={() => setOwner(false)}
            onRefresh={async () => {
              setRevision((n) => n + 1);
            }}
            onDelete={async () => undefined}
          />
        )}
      </Box>
    </ThemeProvider>
  );
}
createRoot(document.getElementById('root')!).render(<Preview />);
