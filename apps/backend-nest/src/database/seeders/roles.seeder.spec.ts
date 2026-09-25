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
