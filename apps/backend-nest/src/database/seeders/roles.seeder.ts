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
    });

    if (exists) {
      console.log(`Role ${data.name} already exists`);
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
