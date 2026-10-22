import { rolesData } from '../data/roles.data';
import type { Repository } from 'typeorm';

import { Permission } from 'src/entities/permissions/permissions.entity';
import { Role } from 'src/entities/roles/roles.entity';
import { RoleSeeder } from './roles.seeder';

describe('RoleSeeder', () => {
  const roleRepository = {
    create: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
  };
  const permissionRepository = {
    find: jest.fn(),
  };

  const seeder = new RoleSeeder(
    roleRepository as unknown as Repository<Role>,
    permissionRepository as unknown as Repository<Permission>,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('adds only missing seeded permissions to an existing role', async () => {
    const existingPermission = {
      idPermission: 1,
      name: 'role.get-all',
    } as Permission;
    const missingPermission = {
      idPermission: 2,
      name: 'role.update',
    } as Permission;
    const existingRole = {
      idRole: 1,
      name: 'ADMIN',
      description: 'Customized description',
      permissions: [existingPermission],
    } as Role;

    permissionRepository.find.mockResolvedValue([existingPermission, missingPermission]);
    roleRepository.findOne.mockResolvedValue(existingRole);

    await seeder.create({
      name: 'ADMIN',
      description: 'Default description',
      permissions: [existingPermission.name, missingPermission.name],
    });

    expect(existingRole.permissions).toEqual([existingPermission, missingPermission]);
    expect(existingRole.description).toBe('Customized description');
    expect(roleRepository.save).toHaveBeenCalledWith(existingRole);
  });
});

// The real persona seed must upgrade existing assignments without removing custom ones.
describe.each(['STUDENT', 'ASSISTANT'])('%s personal listing seed', (name) => {
  it('adds the listing permission to an existing role and is idempotent', async () => {
    const data = rolesData.find((role) => role.name === name)!;
    const custom = { name: 'custom.keep' } as Permission;
    const existing = { name, permissions: [custom] } as Role;
    const permissions = data.permissions.map((permission) => ({ name: permission }) as Permission);
    const repository = { findOne: jest.fn().mockResolvedValue(existing), save: jest.fn() };
    const seeder = new RoleSeeder(
      repository as unknown as Repository<Role>,
      {
        find: jest.fn().mockResolvedValue(permissions),
      } as unknown as Repository<Permission>,
    );
    await seeder.create(data);
    await seeder.create(data);
    expect(existing.permissions).toContain(custom);
    expect(
      existing.permissions.filter((p) => p.name === 'enrollment.get-my-enrollments'),
    ).toHaveLength(1);
    expect(repository.save).toHaveBeenCalledTimes(1);
  });
});
