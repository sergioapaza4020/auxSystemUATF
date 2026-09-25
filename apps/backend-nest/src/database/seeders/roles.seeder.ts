import { Role } from 'src/entities/roles/roles.entity';
import { Permission } from 'src/entities/permissions/permissions.entity';
import { In, Repository } from 'typeorm';
import { RoleSeed } from '../interfaces/roles.interface';
import { rolesData } from '../data/roles.data';

export class RoleSeeder {
  constructor(
    private readonly repository: Repository<Role>,
    private readonly permissionRepository: Repository<Permission>,
  ) {}

  async run() {
    for (const item of rolesData) {
      await this.create(item);
    }
  }

  async create(data: RoleSeed) {
    const permissions = await this.permissionRepository.find({
      where: {
        name: In(data.permissions),
      },
    });

    if (permissions.length !== data.permissions.length) {
      throw new Error(`Some permissions not found for role ${data.name}`);
    }

    const exists = await this.repository.findOne({
      where: {
        name: data.name,
      },
      relations: {
        permissions: true,
      },
    });

    if (exists) {
      const assignedPermissionNames = new Set(
        exists.permissions.map((permission) => permission.name),
      );
      const missingPermissions = permissions.filter(
        (permission) => !assignedPermissionNames.has(permission.name),
      );

      if (missingPermissions.length > 0) {
        exists.permissions.push(...missingPermissions);

        await this.repository.save(exists);
      }

      return;
    }

    const role = this.repository.create({
      name: data.name,
      description: data.description,
      permissions,
    });

    await this.repository.save(role);
  }
}
