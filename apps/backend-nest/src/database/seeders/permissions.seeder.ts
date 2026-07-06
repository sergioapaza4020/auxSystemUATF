import { DeepPartial } from 'typeorm';

import { BaseSeeder } from './base.seeder';

import { Permission } from 'src/entities/permissions/permissions.entity';
import { permissionsData } from '../data/permissions.data';

export class PermissionSeeder extends BaseSeeder<Permission> {
  protected data(): DeepPartial<Permission[]> {
    return permissionsData;
  }

  protected where(item: DeepPartial<Permission>) {
    return {
      name: item.name,
    };
  }
}
