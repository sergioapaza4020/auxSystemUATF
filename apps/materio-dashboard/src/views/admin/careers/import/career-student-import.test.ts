import { describe, expect, it } from 'vitest';

import type { ICareerStudentImportRow } from '@/interfaces/careers/career-student-import.interface';
import { canConfirmCareerStudentImport, filterCareerStudentImportRows } from './career-student-import';
import { validateImportFile } from '../../../../utils/importFile';

const rows: ICareerStudentImportRow[] = [
  {
    row: 2,
    studentId: 7,
    fullName: 'Ana Pérez',
    ru: '00123',
    username: 'ana123',
    email: 'ana@example.com',
    currentCareer: null,
    status: 'VALID',
    errors: [],
  },
  {
    row: 8,
    studentId: null,
    fullName: null,
    ru: '404',
    username: null,
    email: null,
    currentCareer: { idCareer: 3, name: 'Ingeniería Civil' },
    status: 'INVALID',
    errors: ['No existe un estudiante con este RU'],
  },
];

describe('Career student import review', () => {
  it.each(['ANA PÉREZ', '00123', 'ana123', 'ana@example.com'])(
    'searches %s locally and preserves actual Excel rows',
    (search) => {
      expect(filterCareerStudentImportRows(rows, ` ${search} `, 'all').map((row) => row.row)).toEqual([2]);
    },
  );
  it('combines status and search, including unresolved students and empty results', () => {
    expect(filterCareerStudentImportRows(rows, '', 'INVALID').map((row) => row.row)).toEqual([8]);
    expect(filterCareerStudentImportRows(rows, '404', 'VALID')).toEqual([]);
    expect(filterCareerStudentImportRows(rows, '', 'all')).toHaveLength(2);
  });
  it('blocks empty, invalid or inconsistent previews', () => {
    expect(canConfirmCareerStudentImport(null)).toBe(false);
    expect(canConfirmCareerStudentImport({ total: 0, valid: 0, invalid: 0, rows: [] })).toBe(false);
    expect(canConfirmCareerStudentImport({ total: 2, valid: 1, invalid: 1, rows })).toBe(false);
    expect(canConfirmCareerStudentImport({ total: 2, valid: 2, invalid: 0, rows })).toBe(false);
    expect(canConfirmCareerStudentImport({ total: 1, valid: 1, invalid: 0, rows: [rows[0]] })).toBe(true);
  });
  it('checks XLSX and the exact size boundary without upload', () => {
    expect(validateImportFile({ name: 'file.XLSX', size: 5 * 1024 * 1024 })).toBe('');
    expect(validateImportFile({ name: 'file.xlsx', size: 5 * 1024 * 1024 + 1 })).not.toBe('');
    expect(validateImportFile({ name: 'file.csv', size: 10 })).not.toBe('');
    expect(validateImportFile({ name: 'file.xlsx', size: 0 })).not.toBe('');
  });
});

it('searches the current career without losing the conflict row', () => {
  expect(filterCareerStudentImportRows(rows, 'civil', 'all').map((row) => row.row)).toEqual([8]);
  expect(filterCareerStudentImportRows(rows, 'civil', 'VALID')).toEqual([]);
});
