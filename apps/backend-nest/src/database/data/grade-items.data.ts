import { GradeItem } from 'src/entities/grade-items/grade-items.entity';
import { DeepPartial } from 'typeorm';

export const gradeItemsData: DeepPartial<GradeItem>[] = [
  {
    name: 'Parciales',
  },
  {
    name: 'Prácticas',
  },
  {
    name: 'Laboratorio',
  },
  {
    name: 'Examen final',
  },
  {
    name: 'Segundo turno',
  },

  {
    name: 'Asistencias',
  },
  {
    name: 'Prácticas',
  },
  {
    name: 'Participación',
  },
];
