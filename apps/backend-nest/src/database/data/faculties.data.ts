import { Faculty } from 'src/entities/faculties/faculties.entity';
import { DeepPartial } from 'typeorm';

export const facultiesData: DeepPartial<Faculty>[] = [
  {
    name: 'Facultad de artes',
  },
  {
    name: 'Facultad de ciencias agrícolas y pecuarias',
  },
  {
    name: 'Facultad de ciencias económicas, administrativas y financieras',
  },
  {
    name: 'Facultad de ciencias puras',
  },
  {
    name: 'Facultad de ciencias sociales y humanísticas',
  },
  {
    name: 'Facultad de derecho',
  },
  {
    name: 'Facultad de ingeniería',
  },
  {
    name: 'Facultad de ingeniería geológica',
  },
  {
    name: 'Facultad de ingeniería minera',
  },
  {
    name: 'Facultad de ingeniería tecnológica',
  },
  {
    name: 'Facultad de ciencias de la salud',
  },
  {
    name: 'Facultad de medicina',
  },
  {
    name: 'Vicerrectorado',
  },
];
