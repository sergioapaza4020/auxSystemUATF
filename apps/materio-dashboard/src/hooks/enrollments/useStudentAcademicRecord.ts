import { useEffect, useState } from 'react';

import type { IIndividualStudentGradeSummary } from '@/interfaces/enrollments/student-grade-summary.interface';

import { getManagedEnrollment, getIndividualStudentGradeSummary } from '@/api/enrollments.service';
import { getMyAssistantGradeScheme } from '@/api/assistant-grade-schemes.service';
import { getGradesByEnrollment } from '@/api/grades.service';
import { getStudentAttendance } from '@/api/attendances.service';
import { getApiErrorMessage } from '@/utils/http/getApiErrorMessage';
import type { IEnrollment } from '@/interfaces/enrollments/enrollment.interface';
import type { IAssistantGradeScheme } from '@/interfaces/grade-schemes/assistant-grade-scheme.interface';
import type { IGrade } from '@/interfaces/grades/grade.interface';
import type { IStudentAttendance } from '@/interfaces/attendances/attendance.interface';

interface AcademicRecord {
  summary: IIndividualStudentGradeSummary;
  enrollment: IEnrollment;
  scheme: IAssistantGradeScheme | null;
  grades: IGrade[];
  attendance: IStudentAttendance | null;
  attendanceError: string | null;
}

export function useStudentAcademicRecord(idEnrollment: number, studentEnrollmentId: number, canReadAttendance = true) {
  const [record, setRecord] = useState<AcademicRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;

    setRecord(null);
    setError(null);
    setLoading(true);

    const load = async () => {
      try {
        // Validate both route IDs before loading the individual resources.
        const summary = await getIndividualStudentGradeSummary(idEnrollment, studentEnrollmentId);
        const enrollment = await getManagedEnrollment(studentEnrollmentId, false);

        if (!enrollment) throw new Error('No se encontró la matriculación del estudiante.');

        const [scheme, grades, attendance] = await Promise.allSettled([
          getMyAssistantGradeScheme(enrollment.course.idCourse, idEnrollment),
          getGradesByEnrollment(studentEnrollmentId),
          canReadAttendance ? getStudentAttendance(studentEnrollmentId) : Promise.resolve(null),
        ]);

        if (scheme.status === 'rejected') throw scheme.reason;
        if (grades.status === 'rejected') throw grades.reason;

        if (active) {
          setRecord({
            summary,
            enrollment,
            scheme: scheme.value,
            grades: grades.value,
            attendance: attendance.status === 'fulfilled' ? attendance.value : null,
            attendanceError: !canReadAttendance
              ? 'No tienes permiso para consultar el registro de asistencia.'
              : attendance.status === 'rejected'
                ? getApiErrorMessage(attendance.reason)
                : null,
          });
        }
      } catch (reason) {
        if (active) setError(getApiErrorMessage(reason));
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [idEnrollment, studentEnrollmentId, revision, canReadAttendance]);

  return { record, loading, error, revision, reload: () => setRevision((value) => value + 1) };
}
