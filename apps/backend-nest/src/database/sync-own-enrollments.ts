import AppDataSource from './datasource';
import { Role } from 'src/entities/roles/roles.entity';
import { Permission } from 'src/entities/permissions/permissions.entity';
import { RoleSeeder } from './seeders/roles.seeder';
import { rolesData } from './data/roles.data';

// Deliberately avoids the general seed and preserves all custom assignments.
async function syncOwnEnrollments() {
  await AppDataSource.initialize();
  try {
    await AppDataSource.transaction(async (manager) => {
      const roles = manager.getRepository(Role);
      const permissions = manager.getRepository(Permission);
      const permissionName = 'enrollment.get-my-enrollments';
      const permission = await permissions.findOneBy({ name: permissionName, isActive: true });
      if (!permission) throw new Error('Required active permission not found');
      const seeder = new RoleSeeder(roles, permissions);
      for (const name of ['STUDENT', 'ASSISTANT']) {
        const definition = rolesData.find((role) => role.name === name);
        const role = await roles.findOne({
          where: { name, isActive: true },
          relations: { permissions: true },
        });
        if (!definition?.permissions.includes(permissionName) || !role) {
          throw new Error('Required existing active role or seed definition not found');
        }
        const before = role.permissions.map((item) => item.name);
        await seeder.create({ ...definition, permissions: [permissionName] });
        const updated = await roles.findOneOrFail({
          where: { idRole: role.idRole },
          relations: { permissions: true },
        });
        const after = updated.permissions.map((item) => item.name);
        if (!after.includes(permissionName) || before.some((name) => !after.includes(name))) {
          throw new Error('Permission synchronization verification failed');
        }
        console.log(
          JSON.stringify({
            role: name,
            added: before.includes(permissionName) ? [] : [permissionName],
            totalPermissions: after.length,
          }),
        );
      }
    });
    console.log('Own enrollment permissions synchronized');
  } finally {
    await AppDataSource.destroy();
  }
}

void syncOwnEnrollments().catch(() => {
  console.error('Own enrollment permission synchronization failed; transaction rolled back');
  process.exitCode = 1;
});
