import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Enrollment } from 'src/entities/enrollments/enrollments.entity';
import { GradeSchemeDetail } from 'src/entities/grade-scheme-detail/grade-scheme-detail.entity';
import { Activity } from 'src/entities/activities/activity.entity';

export function assertGradeScore(score: number): void {
  if (!Number.isFinite(score) || score < 0 || score > 100) {
    throw new BadRequestException('La calificación debe ser un número entre 0 y 100.');
  }
}

export function assertGradeSchemeAccess(
  idUser: number,
  enrollment: Enrollment,
  detail: GradeSchemeDetail,
): void {
  if (detail.isActive === false) {
    throw new BadRequestException('El criterio está archivado y no admite nuevas calificaciones');
  }
  const assistant = detail.gradeScheme.assistantEnrollment;
  if (assistant) {
    if (assistant.user.idUser !== idUser) {
      throw new ForbiddenException(
        'No tienes permisos para registrar notas en esta configuración de auxiliar',
      );
    }
    if (!assistant.isActive)
      throw new ForbiddenException('La matrícula del auxiliar no está activa');
    if (assistant.course.idCourse !== enrollment.course.idCourse) {
      throw new BadRequestException('La configuración del auxiliar no pertenece a esta materia');
    }
    if (
      assistant.semester &&
      enrollment.semester &&
      assistant.semester.idSemester !== enrollment.semester.idSemester
    ) {
      throw new BadRequestException('La matrícula no pertenece al semestre del auxiliar');
    }
  } else if (enrollment.course.gradeScheme?.idGradeScheme !== detail.gradeScheme.idGradeScheme) {
    throw new BadRequestException('El componente de nota no pertenece al esquema de la materia');
  }
}

export function assertGradeActivity(
  activity: Activity | null,
  detail: GradeSchemeDetail,
): asserts activity is Activity {
  if (!activity || !activity.isActive || activity.deletedAt) {
    throw new NotFoundException('Actividad no encontrada o inactiva');
  }
  if (activity.gradeSchemeDetail.idGradeSchemeDetail !== detail.idGradeSchemeDetail) {
    throw new BadRequestException('La actividad no pertenece al componente de nota indicado');
  }
  if (activity.gradeSchemeDetail.gradeScheme.idGradeScheme !== detail.gradeScheme.idGradeScheme) {
    throw new BadRequestException('La actividad no pertenece al esquema de la materia');
  }
}
