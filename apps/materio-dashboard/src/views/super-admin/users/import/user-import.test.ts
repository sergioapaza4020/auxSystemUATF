import { describe, expect, it } from 'vitest';

import { importRoles, requiresRu, validateImportFile } from './user-import';

describe('User import rules', () => {
  it('only offers the five importable roles with their credential rules', () => {
    expect(importRoles.map((role) => role.value)).toEqual(['STUDENT', 'ASSISTANT', 'TEACHER', 'DIRECTOR', 'DEAN']);
    expect(importRoles.filter((role) => requiresRu(role.value)).map((role) => role.value)).toEqual([
      'STUDENT',
      'ASSISTANT',
    ]);
  });

  it('validates extension, empty files and the 5 MB boundary before upload', () => {
    expect(validateImportFile({ name: 'users.XLSX', size: 5 * 1024 * 1024 })).toBe('');
    expect(validateImportFile({ name: 'users.xlsx', size: 5 * 1024 * 1024 + 1 })).not.toBe('');
    expect(validateImportFile({ name: 'users.csv', size: 100 })).not.toBe('');
    expect(validateImportFile({ name: 'users.xlsx', size: 0 })).not.toBe('');
  });
});
