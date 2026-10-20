'use client';

import { useState } from 'react';

import { useParams } from 'next/navigation';

import { isAttendanceCriterion } from '@repo/grade-calculations';
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
} from '@mui/material';

import { useAuth } from '@/hooks/useAuth';
import { hasPermission } from '@/utils/hasPermission';
import { useStudentAcademicRecord } from '@/hooks/enrollments/useStudentAcademicRecord';
import { StudentAcademicRecord } from '@/views/admin/enrollments/student-record/StudentAcademicRecord';
import { GradesCard } from '@/views/admin/enrollments/grades-card/GradesCard';

function StudentRecordContent({
  idEnrollment,
  studentEnrollmentId,
}: {
  idEnrollment: number;
  studentEnrollmentId: number;
}) {
  const { user } = useAuth();

  const data = useStudentAcademicRecord(
    idEnrollment,
    studentEnrollmentId,
    hasPermission(user, 'attendance.student.get'),
  );

  const [directOpen, setDirectOpen] = useState(false);
  const canEdit = hasPermission(user, 'grade.create') && hasPermission(user, 'grade.update');
  const record = data.record;

  const directDetails =
    record?.scheme?.details.filter(
      (detail) =>
        !isAttendanceCriterion(detail.gradeItem.name) && !detail.activities.some((activity) => activity.isActive),
    ) ?? [];

  const reload = () => {
    setDirectOpen(false);
    data.reload();
  };

  const error = data.error;

  if (data.loading) return <CircularProgress aria-label='Cargando ficha académica' />;

  if (error || !record || record.summary.student.idEnrollment !== studentEnrollmentId) {
    return (
      <Stack spacing={2}>
        <Button href={`/dashboard/enrollments/${idEnrollment}`}>Volver a la materia</Button>
        <Alert severity='error'>{error || 'No se encontró al estudiante en esta materia.'}</Alert>
        <Button
          onClick={() => {
            data.reload();
          }}
        >
          Reintentar
        </Button>
      </Stack>
    );
  }

  return (
    <>
      <StudentAcademicRecord
        idEnrollment={idEnrollment}
        enrollment={record.enrollment}
        scheme={record.scheme}
        summary={record.summary}
        grades={record.grades}
        attendance={record.attendance}
        attendanceError={record.attendanceError}
        canEdit={canEdit}
        canViewAttendance={
          hasPermission(user, 'attendance.session.get-by-enrollment') &&
          hasPermission(user, 'attendance.session.get-one')
        }
        onManageDirect={canEdit && directDetails.length ? () => setDirectOpen(true) : undefined}
      />
      {canEdit && record.scheme && directOpen && (
        <Dialog open onClose={() => setDirectOpen(false)} fullWidth maxWidth='sm'>
          <DialogTitle>Gestionar criterios directos</DialogTitle>
          <DialogContent>
            <Alert severity='info' sx={{ mb: 2 }}>
              Las notas de actividades se gestionan desde Grade Matrix.
            </Alert>
            <GradesCard
              enrollment={record.enrollment}
              grades={record.grades}
              loading={false}
              isEditable
              canDelete={hasPermission(user, 'grade.remove')}
              gradeScheme={{
                ...record.scheme,
                details: directDetails.map((detail) => ({ ...detail, activities: [] })),
              }}
              schemeMultiplier={Number(record.scheme.assistantPercentage) / 100}
              onGradesChanged={reload}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDirectOpen(false)}>Cerrar</Button>
          </DialogActions>
        </Dialog>
      )}
    </>
  );
}

export default function StudentEnrollmentDetailPage() {
  const params = useParams();
  const { user } = useAuth();
  const idEnrollment = Number(params.idEnrollment);
  const studentEnrollmentId = Number(params.studentEnrollmentId);

  if (!hasPermission(user, 'enrollment.get-managed-enrollment') || !hasPermission(user, 'grade.get-by-enrollment')) {
    return <Alert severity='warning'>No tienes permiso para consultar esta ficha académica.</Alert>;
  }

  if (![idEnrollment, studentEnrollmentId].every((id) => Number.isInteger(id) && id > 0)) {
    return <Alert severity='error'>La matrícula indicada no es válida.</Alert>;
  }

  return (
    <StudentRecordContent
      key={`${idEnrollment}:${studentEnrollmentId}`}
      idEnrollment={idEnrollment}
      studentEnrollmentId={studentEnrollmentId}
    />
  );
}
