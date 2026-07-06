import { GradeScheme } from 'src/entities/grade-schemes/grade-schemes.entity';
import { DeepPartial } from 'typeorm';

export const gradeSchemesData: DeepPartial<GradeScheme>[] = [
  {
    name: 'Evaluación teórica - experimental 001',
    description: 'Esquema de calificación teórico - experimental 001',
  },
  {
    name: 'Evaluación teórica 001',
    description: 'Esquema de calificación teórico 001',
  },
  {
    name: 'Evaluación teórica 002',
    description: 'Esquema de calificación teórico 002',
  },
  {
    name: 'Evaluación experimental - seminario 001',
    description: 'Esquema de calificación experimental - seminario 001',
  },

  {
    name: 'Evaluación auxiliatura 001',
    description: 'Esquema de calificación auxiliatura 001',
  },
  {
    name: 'Evaluación auxiliatura 002',
    description: 'Esquema de calificación auxiliatura 002',
  },
  {
    name: 'Evaluación auxiliatura 003',
    description: 'Esquema de calificación auxiliatura 003',
  },
  {
    name: 'Evaluación auxiliatura 004',
    description: 'Esquema de calificación auxiliatura 004',
  },
];
