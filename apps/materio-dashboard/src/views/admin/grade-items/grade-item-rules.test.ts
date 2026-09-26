import { describe, expect, it } from 'vitest';

import { gradeItemNameError, isAttendanceItem } from './grade-item-rules';

describe('Grade item attendance compatibility', () => {
  it.each(['Asistencias', 'Asistencia', ' ASISTENCIAS ', 'Control de asistencia'])(
    'protects the existing attendance name %s',
    (name) => {
      expect(isAttendanceItem(name)).toBe(true);
      expect(gradeItemNameError('Prácticas', [], { idGradeItem: 1, name, isActive: true })).not.toBe('');
    },
  );

  it('prevents converting an ordinary item into attendance or creating another reserved item', () => {
    expect(gradeItemNameError('Asistencias', [])).not.toBe('');
    expect(gradeItemNameError('Asistencia', [], { idGradeItem: 2, name: 'Exámenes', isActive: true })).not.toBe('');
  });

  it('checks inactive duplicates and whitespace without blocking ordinary edits', () => {
    const item = { idGradeItem: 1, name: 'Prácticas', isActive: false };

    expect(gradeItemNameError(' prácticas ', [item])).toContain('reactivarlo');
    expect(gradeItemNameError('   ', [])).not.toBe('');
    expect(gradeItemNameError('Prácticas', [item], item)).toBe('');
    expect(gradeItemNameError('Proyectos', [item])).toBe('');
  });
});
