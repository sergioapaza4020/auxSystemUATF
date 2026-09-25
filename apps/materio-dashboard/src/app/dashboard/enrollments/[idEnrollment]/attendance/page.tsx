'use client';

import { useEffect, useState } from 'react';

import { useParams, useRouter } from 'next/navigation';

import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  CircularProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';

import { ArrowBack } from '@mui/icons-material';

import { useSnackbar } from '@/hooks/useSnackbar';
import { useEnrollment } from '@/hooks/enrollments/useEnrollment';
import { getEnrollmentStudents } from '@/api/enrollments.service';

import { EnrollmentHeader } from '@/views/admin/enrollments/EnrollmentHeader';

import type { IEnrollmentStudent } from '@/interfaces/enrollments/enrollment-student.interface';

import { useAttendances } from '@/hooks/attendances/useAttendances';
import { AttendanceStatus } from '@/enums/attendanceStatus';

export default function AttendancePage() {
  const params = useParams();
  const router = useRouter();

  const idEnrollment = Number(params.idEnrollment);

  const [students, setStudents] = useState<IEnrollmentStudent[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const snackbar = useSnackbar();

  const { enrollment, loading: loadingEnrollment } = useEnrollment(idEnrollment);

  const {
    sessions,
    loading: loadingSessions,
    saving,
    createSession,
    loadSession,
    saveSessionAttendances,
    session,
  } = useAttendances(idEnrollment);

  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);

  const [attendance, setAttendance] = useState<Record<number, AttendanceStatus>>({});

  useEffect(() => {
    const loadStudents = async () => {
      if (!enrollment) return;

      setLoadingStudents(true);

      try {
        const data = await getEnrollmentStudents(enrollment.idEnrollment);

        setStudents(data);
      } catch (error) {
        snackbar.error('No se pudieron cargar los estudiantes.');
      } finally {
        setLoadingStudents(false);
      }
    };

    void loadStudents();
  }, [enrollment, snackbar]);

  useEffect(() => {
    if (!session || students.length === 0) return;

    const initialAttendance: Record<number, AttendanceStatus> = {};

    students.forEach((student) => {
      initialAttendance[student.idEnrollment] = AttendanceStatus.ABSENT;
    });

    (session.attendances ?? []).forEach((item) => {
      initialAttendance[item.enrollment.idEnrollment] = item.status;
    });

    setAttendance(initialAttendance);
  }, [session, students]);

  const handleCreateSession = async () => {
    if (!selectedDate) {
      snackbar.error('Selecciona una fecha.');

      return;
    }

    const existingSession = sessions.find((item) => item.date === selectedDate);

    if (existingSession) {
      setSelectedSessionId(existingSession.idAttendanceSession);

      try {
        await loadSession(existingSession.idAttendanceSession);

        snackbar.success('Se abrió la sesión de asistencia existente.');
      } catch (error) {
        snackbar.error('No se pudo cargar la sesión de asistencia.');
      }

      return;
    }

    try {
      const newSession = await createSession(selectedDate);

      setSelectedSessionId(newSession.idAttendanceSession);

      await loadSession(newSession.idAttendanceSession);

      snackbar.success('Sesión de asistencia creada.');
    } catch (error) {
      snackbar.error('No se pudo crear la sesión de asistencia.');
    }
  };

  const handleSelectSession = async (idSession: number) => {
    setSelectedSessionId(idSession);

    try {
      await loadSession(idSession);
    } catch (error) {
      snackbar.error('No se pudo cargar la sesión de asistencia.');
    }
  };

  const handleChangeAttendance = (idStudentEnrollment: number, status: AttendanceStatus) => {
    setAttendance((current) => ({
      ...current,
      [idStudentEnrollment]: status,
    }));
  };

  const handleSave = async () => {
    if (!selectedSessionId) return;

    try {
      await saveSessionAttendances(selectedSessionId, {
        attendances: students.map((student) => ({
          enrollmentId: student.idEnrollment,
          status: attendance[student.idEnrollment] ?? 'ABSENT',
        })),
      });

      snackbar.success('Asistencia guardada correctamente.');
    } catch (error) {
      snackbar.error('No se pudo guardar la asistencia.');
    }
  };

  if (loadingEnrollment) {
    return <CircularProgress />;
  }

  if (!enrollment) {
    return <Typography color='error'>No se encontró la matriculación.</Typography>;
  }

  const presentCount = students.filter(
    (student) => attendance[student.idEnrollment] === AttendanceStatus.PRESENT,
  ).length;

  const absentCount = students.filter((student) => attendance[student.idEnrollment] === AttendanceStatus.ABSENT).length;

  const formatDate = (date: string) => {
    const [year, month, day] = date.split('-');

    return `${day}/${month}/${year}`;
  };

  return (
    <Box>
      <Stack spacing={4}>
        <EnrollmentHeader enrollment={enrollment} />

        <Button
          startIcon={<ArrowBack />}
          onClick={() => {
            router.push(`/dashboard/enrollments/${idEnrollment}`);
          }}
          sx={{ alignSelf: 'flex-start' }}
        >
          Volver
        </Button>

        <Card>
          <CardHeader title='Asistencia' subheader='Gestiona la asistencia de los estudiantes del curso.' />

          <CardContent>
            <Stack spacing={3}>
              <TextField
                label='Fecha'
                type='date'
                value={selectedDate}
                onChange={(event) => {
                  setSelectedDate(event.target.value);
                }}
              />

              <Button variant='contained' onClick={handleCreateSession} disabled={saving || !selectedDate}>
                {saving ? 'Creando...' : 'Nueva sesión de asistencia'}
              </Button>
            </Stack>
          </CardContent>
        </Card>

        <Card>
          <CardHeader title='Historial de asistencia' subheader={`${sessions.length} sesión(es) registrada(s)`} />

          <CardContent>
            {loadingSessions ? (
              <CircularProgress size={24} />
            ) : sessions.length === 0 ? (
              <Typography color='text.secondary'>No existen sesiones de asistencia.</Typography>
            ) : (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Fecha</TableCell>
                      <TableCell align='center'>Presentes</TableCell>
                      <TableCell align='center'>Ausentes</TableCell>
                      <TableCell align='right'>Acción</TableCell>
                    </TableRow>
                  </TableHead>

                  <TableBody>
                    {sessions.map((item) => (
                      <TableRow key={item.idAttendanceSession}>
                        <TableCell>{formatDate(item.date)}</TableCell>

                        <TableCell align='center'>{item.presentCount}</TableCell>

                        <TableCell align='center'>{item.absentCount}</TableCell>

                        <TableCell align='right'>
                          <Button variant='outlined' onClick={() => handleSelectSession(item.idAttendanceSession)}>
                            Ver
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>

        {selectedSessionId && (
          <Card>
            <CardHeader
              title='Registro de asistencia'
              subheader={session?.date ? `Fecha: ${session.date}` : 'Fecha no disponible'}
            />

            <CardContent>
              <Stack direction='row' spacing={2}>
                <Typography>
                  Total: <strong>{students.length}</strong>
                </Typography>

                <Typography color='success.main'>
                  Presentes: <strong>{presentCount}</strong>
                </Typography>

                <Typography color='error.main'>
                  Ausentes: <strong>{absentCount}</strong>
                </Typography>
              </Stack>
              {loadingStudents || !session ? (
                <CircularProgress size={24} />
              ) : (
                <Stack spacing={2}>
                  {students.map((student) => {
                    const status = attendance[student.idEnrollment] ?? 'ABSENT';

                    return (
                      <Stack
                        key={student.idEnrollment}
                        direction='row'
                        justifyContent='space-between'
                        alignItems='center'
                      >
                        <Box>
                          <Typography fontWeight={600}>
                            {student.user.name} {student.user.lastname}
                          </Typography>

                          <Typography variant='body2' color='text.secondary'>
                            CI: {student.user.ci} · RU: {student.user.ru}
                          </Typography>
                        </Box>

                        <ToggleButtonGroup
                          exclusive
                          value={status}
                          onChange={(_, value: AttendanceStatus | null) => {
                            if (value !== null) {
                              handleChangeAttendance(student.idEnrollment, value);
                            }
                          }}
                        >
                          <ToggleButton value={AttendanceStatus.PRESENT}>Presente</ToggleButton>

                          <ToggleButton value={AttendanceStatus.ABSENT}>Ausente</ToggleButton>
                        </ToggleButtonGroup>
                      </Stack>
                    );
                  })}

                  <Button variant='contained' onClick={handleSave} disabled={saving || students.length === 0}>
                    {saving ? 'Guardando...' : 'Guardar asistencia'}
                  </Button>
                </Stack>
              )}
            </CardContent>
          </Card>
        )}
      </Stack>
    </Box>
  );
}
