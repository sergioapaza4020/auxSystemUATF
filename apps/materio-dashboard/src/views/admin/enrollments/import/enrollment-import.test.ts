import { describe, expect, it } from 'vitest';

import type { IEnrollmentImportRow } from '@/interfaces/enrollments/enrollment-import.interface';
import { canConfirmEnrollmentImport, enrollmentImportActionLabel } from './enrollment-import';
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
  it('blocks empty, invalid or inconsistent previews', () => {
    expect(canConfirmEnrollmentImport(null)).toBe(false);
    expect(
      canConfirmEnrollmentImport({
        operationId: 'operation-id',
        meta: { page: 1, limit: 25, total: 100, totalPages: 4 },
        total: 0,
        valid: 0,
        invalid: 0,
        data: [],
      }),
    ).toBe(false);
    expect(
      canConfirmEnrollmentImport({
        operationId: 'operation-id',
        meta: { page: 1, limit: 25, total: 100, totalPages: 4 },
        total: 2,
        valid: 1,
        invalid: 1,
        data: rows,
      }),
    ).toBe(false);
    expect(
      canConfirmEnrollmentImport({
        operationId: 'operation-id',
        meta: { page: 1, limit: 25, total: 100, totalPages: 4 },
        total: 2,
        valid: 2,
        invalid: 0,
        data: rows,
      }),
    ).toBe(true);
    expect(
      canConfirmEnrollmentImport({
        operationId: 'operation-id',
        meta: { page: 1, limit: 25, total: 100, totalPages: 4 },
        total: 1,
        valid: 1,
        invalid: 0,
        data: [rows[0]],
      }),
    ).toBe(true);
  });
  it('checks XLSX and the exact size boundary without upload', () => {
    expect(validateImportFile({ name: 'file.XLSX', size: 5 * 1024 * 1024 })).toBe('');
    expect(validateImportFile({ name: 'file.xlsx', size: 5 * 1024 * 1024 + 1 })).not.toBe('');
    expect(validateImportFile({ name: 'file.csv', size: 10 })).not.toBe('');
    expect(validateImportFile({ name: 'file.xlsx', size: 0 })).not.toBe('');
  });
});

// Skipped rows are valid; they must not block an otherwise clean operation.
it('accepts all-skipped previews and labels each domain action without exposing CI', () => {
  const preview = {
    operationId: 'op',
    total: 1,
    valid: 1,
    invalid: 0,
    skipped: 1,
    data: [],
    meta: { page: 1, limit: 25, total: 1, totalPages: 1 },
  };

  expect(canConfirmEnrollmentImport(preview)).toBe(true);
  expect(enrollmentImportActionLabel({ status: 'VALID', action: 'CREATE_ACCOUNT' })).toBe('Crear cuenta y matricular');
  expect(enrollmentImportActionLabel({ status: 'VALID', action: 'ENROLL' })).toBe('Usar cuenta existente y matricular');
  expect(enrollmentImportActionLabel({ status: 'VALID', action: 'SKIP' })).toBe('Ya matriculado: se omitirá');
  expect(enrollmentImportActionLabel({ status: 'INVALID', action: 'ERROR' })).toBe('Error');
});
