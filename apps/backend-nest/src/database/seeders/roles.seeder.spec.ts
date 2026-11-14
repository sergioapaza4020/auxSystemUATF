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

describe('Student check-in seed', () => {
  it('assigns QR grants separately without leaking student check-in to ASSISTANT', () => {
    const student = rolesData.find((role) => role.name === 'STUDENT')!;
    const assistant = rolesData.find((role) => role.name === 'ASSISTANT')!;
    expect(student.permissions).toContain('attendance.qr.check-in');
    expect(student.permissions).not.toContain('attendance.qr.get');
    expect(assistant.permissions).toContain('attendance.qr.get');
    expect(assistant.permissions).not.toContain('attendance.qr.check-in');
  });
  it('assigns check-in to STUDENT without granting auxiliary management or inheriting it into ASSISTANT', () => {
    const student = rolesData.find((role) => role.name === 'STUDENT')!;
    expect(student.permissions).toContain('attendance.check-in');
    expect(student.permissions).not.toContain('attendance.save');
    expect(student.permissions).not.toContain('attendance.session.get-one');
    expect(rolesData.find((role) => role.name === 'ASSISTANT')!.permissions).not.toContain(
      'attendance.check-in',
    );
  });
  it('upgrades an existing STUDENT additively and only once', async () => {
    const data = rolesData.find((role) => role.name === 'STUDENT')!;
    const custom = { name: 'custom.keep' } as Permission;
    const existing = { name: 'STUDENT', permissions: [custom], description: 'Custom' } as Role;
    const repository = { findOne: jest.fn().mockResolvedValue(existing), save: jest.fn() };
    const seeder = new RoleSeeder(
      repository as unknown as Repository<Role>,
      {
        find: jest.fn().mockResolvedValue(data.permissions.map((name) => ({ name }))),
      } as unknown as Repository<Permission>,
    );
    await seeder.create(data);
    await seeder.create(data);
    expect(existing.permissions).toContain(custom);
    expect(
      existing.permissions.filter((permission) => permission.name === 'attendance.check-in'),
    ).toHaveLength(1);
    expect(existing.description).toBe('Custom');
    expect(repository.save).toHaveBeenCalledTimes(1);
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
