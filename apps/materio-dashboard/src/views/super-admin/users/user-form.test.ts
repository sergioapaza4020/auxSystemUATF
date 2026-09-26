import { describe, expect, it } from 'vitest';

import { availableUserRoles, initialUserForm, userCreatePayload, userUpdatePayload } from './user-form';

const user = {
  idUser: 1,
  name: 'Ana',
  lastname: 'Pérez',
  username: 'ana',
  email: 'ana@example.com',
  ci: '123',
  ru: null,
  isActive: true,
  roles: [{ idRole: 1, name: 'STUDENT', isActive: true }],
};

describe('User editing contracts', () => {
  it('never preloads a password, even if an unexpected response contains one', () => {
    expect(initialUserForm({ ...user, ...{ password: 'must-not-reach-form' } }).password).toBe('');
  });

  it('leaves password, roles, identifiers and null RU out of an ordinary edit', () => {
    const form = { ...initialUserForm(user), name: ' Ana María ' };

    expect(userUpdatePayload(form, user)).toEqual({ name: 'Ana María' });
    expect(userUpdatePayload(initialUserForm(user), user)).toEqual({});
  });

  it('sends a new password only when explicitly supplied', () => {
    expect(userUpdatePayload({ ...initialUserForm(user), password: ' new secret ' }, user)).toEqual({
      password: ' new secret ',
    });
  });

  it('creates using the exact fields supported by the DTO', () => {
    const form = { ...initialUserForm(user), ru: '456', password: 'new secret' };

    expect(userCreatePayload(form, ['STUDENT'])).toEqual({
      name: 'Ana',
      lastname: 'Pérez',
      username: 'ana',
      email: 'ana@example.com',
      ci: '123',
      ru: '456',
      password: 'new secret',
      roleNames: ['STUDENT'],
    });
  });

  it('only offers active roles not already assigned, without pretending to replace existing roles', () => {
    const roles = [
      { idRole: 1, name: 'student', isActive: true, permissions: [] },
      { idRole: 2, name: 'ASSISTANT', isActive: true, permissions: [] },
      { idRole: 3, name: 'OLD', isActive: false, permissions: [] },
    ];

    expect(availableUserRoles(roles, user).map((role) => role.name)).toEqual(['ASSISTANT']);
  });
});
