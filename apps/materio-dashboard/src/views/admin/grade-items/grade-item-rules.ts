import type { IGradeItem } from '@/interfaces/grade-items/grade-item.interface';

// Preserve both existing consumers: exact "asistencias" and includes("asistencia").
// Do not rename or introduce this reserved category until it has a stable domain identifier.
export const isAttendanceItem = (name: string) => name.trim().toLowerCase().includes('asistencia');

export function gradeItemNameError(name: string, records: IGradeItem[], editing?: IGradeItem | null): string {
  if (!name.trim()) return 'Escribe un nombre.';

  if ((editing && isAttendanceItem(editing.name)) || isAttendanceItem(name)) {
    return 'El nombre de asistencia está reservado para el registro de asistencia y no puede crearse ni renombrarse aquí.';
  }

  if (
    records.some(
      (item) =>
        item.idGradeItem !== editing?.idGradeItem && item.name.trim().toLowerCase() === name.trim().toLowerCase(),
    )
  ) {
    return 'Ya existe un ítem con este nombre. Si está inactivo, puedes reactivarlo.';
  }

  return '';
}
