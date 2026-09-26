'use client';

import { useEffect, useMemo, useState } from 'react';

import { useParams, useRouter } from 'next/navigation';

import { Box, CircularProgress, Stack, Typography } from '@mui/material';

import { useSnackbar } from '@/hooks/useSnackbar';
import { useEnrollment } from '@/hooks/enrollments/useEnrollment';
import { useAttendances } from '@/hooks/attendances/useAttendances';

import { getEnrollmentStudents } from '@/api/enrollments.service';

import type { IEnrollmentStudent } from '@/interfaces/enrollments/enrollment-student.interface';

import { AttendanceStatus } from '@/enums/attendanceStatus';
import { AttendancePageHeader } from '@/views/attendance/AttendancePageHeader';
import { AttendanceSessionToolbar } from '@/views/attendance/AttendanceSessionToolbar';
import { AttendanceSheet } from '@/views/attendance/AttendanceSheet';
import { AttendanceHistory } from '@/views/attendance/AttendanceHistory';

export default function AttendancePage() {
  const params = useParams();
  const router = useRouter();

  const idEnrollment = Number(params.idEnrollment);

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

  const [students, setStudents] = useState<IEnrollmentStudent[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);

  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();

    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
      2,
      '0',
    )}-${String(now.getDate()).padStart(2, '0')}`;
  });

  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);

  const [attendance, setAttendance] = useState<Record<number, AttendanceStatus>>({});

  /*
   * Snapshot de los datos guardados.
   * Nos permite saber si existen cambios y cancelar.
   */
  const [savedAttendance, setSavedAttendance] = useState<Record<number, AttendanceStatus>>({});

  const [search, setSearch] = useState('');

  /*
   * ============================
   * CARGAR ESTUDIANTES
   * ============================
   */

  useEffect(() => {
    const loadStudents = async () => {
      if (!enrollment) {
        return;
      }

      setLoadingStudents(true);

      try {
        const data = await getEnrollmentStudents(enrollment.idEnrollment);

        setStudents(data);
      } catch {
        snackbar.error('No se pudieron cargar los estudiantes.');
      } finally {
        setLoadingStudents(false);
      }
    };

    void loadStudents();
  }, [enrollment, snackbar]);

  /*
   * ============================
   * CARGAR ASISTENCIA DE SESIÓN
   * ============================
   */

  useEffect(() => {
    if (!session || students.length === 0) {
      return;
    }

    const initialAttendance: Record<number, AttendanceStatus> = {};

    students.forEach((student) => {
      initialAttendance[student.idEnrollment] = AttendanceStatus.ABSENT;
    });

    (session.attendances ?? []).forEach((item) => {
      initialAttendance[item.enrollment.idEnrollment] = item.status;
    });

    setAttendance(initialAttendance);
    setSavedAttendance(initialAttendance);
  }, [session, students]);

  /*
   * ============================
   * DERIVADOS
   * ============================
   */

  const filteredStudents = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return students;
    }

    return students.filter((student) => {
      const user = student.user;

      const searchable = [user.name, user.lastname, user.ci, user.ru, user.username]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return searchable.includes(query);
    });
  }, [students, search]);

  const presentCount = useMemo(
    () => students.filter((student) => attendance[student.idEnrollment] === AttendanceStatus.PRESENT).length,
    [students, attendance],
  );

  const absentCount = useMemo(
    () => students.filter((student) => attendance[student.idEnrollment] === AttendanceStatus.ABSENT).length,
    [students, attendance],
  );

  const hasChanges = useMemo(() => {
    if (!selectedSessionId) {
      return false;
    }

    return students.some((student) => attendance[student.idEnrollment] !== savedAttendance[student.idEnrollment]);
  }, [attendance, savedAttendance, students, selectedSessionId]);

  /*
   * ============================
   * SESIONES
   * ============================
   */

  const handleCreateSession = async () => {
    if (!selectedDate) {
      snackbar.error('Selecciona una fecha.');

      return;
    }

    const existingSession = sessions.find((item) => item.date.slice(0, 10) === selectedDate);

    /*
     * Evitamos duplicados.
     * Si ya existe, simplemente abrimos la sesión.
     */
    if (existingSession) {
      try {
        setSelectedSessionId(existingSession.idAttendanceSession);

        await loadSession(existingSession.idAttendanceSession);

        snackbar.success('Se abrió la sesión de asistencia existente.');
      } catch {
        snackbar.error('No se pudo cargar la sesión de asistencia.');
      }

      return;
    }

    try {
      const newSession = await createSession(selectedDate);

      setSelectedSessionId(newSession.idAttendanceSession);

      await loadSession(newSession.idAttendanceSession);

      snackbar.success('Sesión de asistencia creada.');
    } catch {
      snackbar.error('No se pudo crear la sesión de asistencia.');
    }
  };

  const handleSelectSession = async (idSession: number) => {
    /*
     * Más adelante podemos sustituir esto por
     * un Dialog de confirmación si hasChanges.
     */
    if (hasChanges) {
      const confirmed = window.confirm('Tienes cambios sin guardar. ¿Deseas descartarlos y abrir otra sesión?');

      if (!confirmed) {
        return;
      }
    }

    try {
      setSelectedSessionId(idSession);

      await loadSession(idSession);
    } catch {
      snackbar.error('No se pudo cargar la sesión de asistencia.');
    }
  };

  /*
   * ============================
   * ASISTENCIA
   * ============================
   */

  const handleChangeAttendance = (idStudentEnrollment: number, status: AttendanceStatus) => {
    setAttendance((current) => ({
      ...current,
      [idStudentEnrollment]: status,
    }));
  };

  const handleMarkAll = (status: AttendanceStatus) => {
    setAttendance((current) => {
      const updated = { ...current };

      /*
       * Aplicamos la acción a TODOS los estudiantes,
       * no solamente a los filtrados.
       */
      students.forEach((student) => {
        updated[student.idEnrollment] = status;
      });

      return updated;
    });
  };

  const handleCancelChanges = () => {
    setAttendance({ ...savedAttendance });
  };

  const handleSave = async () => {
    if (!selectedSessionId) {
      return;
    }

    try {
      await saveSessionAttendances(selectedSessionId, {
        attendances: students.map((student) => ({
          enrollmentId: student.idEnrollment,

          status: attendance[student.idEnrollment] ?? AttendanceStatus.ABSENT,
        })),
      });

      setSavedAttendance({ ...attendance });

      snackbar.success('Asistencia guardada correctamente.');
    } catch {
      snackbar.error('No se pudo guardar la asistencia.');
    }
  };

  /*
   * ============================
   * ESTADOS DE PÁGINA
   * ============================
   */

  if (loadingEnrollment) {
    return (
      <Box
        sx={{
          minHeight: 300,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (!enrollment) {
    return <Typography color='error'>No se encontró la matriculación.</Typography>;
  }

  return (
    <Stack spacing={3}>
      <AttendancePageHeader
        enrollment={enrollment}
        studentCount={students.length}
        onBack={() => router.push(`/dashboard/enrollments/${idEnrollment}`)}
      />

      <AttendanceSessionToolbar
        selectedDate={selectedDate}
        selectedSessionId={selectedSessionId}
        session={session}
        saving={saving}
        onDateChange={setSelectedDate}
        onCreateSession={handleCreateSession}
      />

      {selectedSessionId && (
        <AttendanceSheet
          students={filteredStudents}
          totalStudents={students.length}
          attendance={attendance}
          loading={loadingStudents || !session}
          saving={saving}
          search={search}
          presentCount={presentCount}
          absentCount={absentCount}
          hasChanges={hasChanges}
          onSearchChange={setSearch}
          onChangeAttendance={handleChangeAttendance}
          onMarkAllPresent={() => handleMarkAll(AttendanceStatus.PRESENT)}
          onMarkAllAbsent={() => handleMarkAll(AttendanceStatus.ABSENT)}
          onCancelChanges={handleCancelChanges}
          onSave={handleSave}
        />
      )}

      <AttendanceHistory
        sessions={sessions}
        loading={loadingSessions}
        selectedSessionId={selectedSessionId}
        onSelectSession={handleSelectSession}
      />
    </Stack>
  );
}
