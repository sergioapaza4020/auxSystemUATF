import {
  userImportUsername,
  userImportRequiresRu,
  validateUserImportRole,
} from './user-import-rules';

describe('Shared preview and worker credentials rules', () => {
  it.each([
    ['STUDENT', '987654', '987654'],
    ['ASSISTANT', '987654', '987654'],
    ['TEACHER', '', '1234567'],
    ['DIRECTOR', '987654', '1234567'],
    ['DEAN', '', '1234567'],
  ])('uses the same username for %s', (role, ru, username) => {
    expect(validateUserImportRole(role)).toBe(role);
    expect(userImportUsername(role, '1234567', ru)).toBe(username);
    expect(userImportRequiresRu(role)).toBe(['STUDENT', 'ASSISTANT'].includes(role));
  });
  it.each(['ADMIN', 'SUPERADMIN', 'other'])('blocks %s', (role) => {
    expect(() => validateUserImportRole(role)).toThrow();
  });
});
