import { describe, expect, it } from 'vitest';

import type { IEnrollmentImportRow } from '@/interfaces/enrollments/enrollment-import.interface';
import { canConfirmEnrollmentImport, filterEnrollmentImportRows } from './enrollment-import';
import { validateImportFile } from '../../../../utils/importFile';

const rows: IEnrollmentImportRow[] = [
  {
    row: 2,
    studentId: 7,
    fullName: 'Ana Pérez',
    ru: '00123',
    username: 'ana123',
    email: 'ana@example.com',
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
    status: 'INVALID',
    errors: ['No existe un estudiante con este RU'],
  },
];

describe('Enrollment import review', () => {
  it.each(['ANA PÉREZ', '00123', 'ana123', 'ana@example.com'])(
    'searches %s locally and preserves actual Excel rows',
    (search) => {
      expect(filterEnrollmentImportRows(rows, ` ${search} `, 'all').map((row) => row.row)).toEqual([2]);
    },
  );
  it('combines status and search, including unresolved students and empty results', () => {
    expect(filterEnrollmentImportRows(rows, '', 'INVALID').map((row) => row.row)).toEqual([8]);
    expect(filterEnrollmentImportRows(rows, '404', 'VALID')).toEqual([]);
    expect(filterEnrollmentImportRows(rows, '', 'all')).toHaveLength(2);
  });
  it('blocks empty, invalid or inconsistent previews', () => {
    expect(canConfirmEnrollmentImport(null)).toBe(false);
    expect(canConfirmEnrollmentImport({ total: 0, valid: 0, invalid: 0, rows: [] })).toBe(false);
    expect(canConfirmEnrollmentImport({ total: 2, valid: 1, invalid: 1, rows })).toBe(false);
    expect(canConfirmEnrollmentImport({ total: 2, valid: 2, invalid: 0, rows })).toBe(false);
    expect(canConfirmEnrollmentImport({ total: 1, valid: 1, invalid: 0, rows: [rows[0]] })).toBe(true);
  });
  it('checks XLSX and the exact size boundary without upload', () => {
    expect(validateImportFile({ name: 'file.XLSX', size: 5 * 1024 * 1024 })).toBe('');
    expect(validateImportFile({ name: 'file.xlsx', size: 5 * 1024 * 1024 + 1 })).not.toBe('');
    expect(validateImportFile({ name: 'file.csv', size: 10 })).not.toBe('');
    expect(validateImportFile({ name: 'file.xlsx', size: 0 })).not.toBe('');
  });
});
