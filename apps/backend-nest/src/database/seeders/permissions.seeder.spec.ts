import type { Repository } from 'typeorm';
import { Permission } from 'src/entities/permissions/permissions.entity';
import { permissionsData } from '../data/permissions.data';
import { PermissionSeeder } from './permissions.seeder';

describe('Check-in permission seeding', () => {
  it('inserts the new permission without rewriting existing entries and is idempotent', async () => {
    const names = new Set(
      permissionsData.map((item) => item.name).filter((name) => name !== 'attendance.check-in'),
    );
    const repository = {
      metadata: { name: 'Permission' },
      findOne: jest.fn(({ where }: { where: { name: string } }) =>
        Promise.resolve(names.has(where.name) ? { name: where.name } : null),
      ),
      create: jest.fn((value: { name: string }) => value),
      save: jest.fn((value: { name: string }) => {
        names.add(value.name);
        return Promise.resolve(value);
      }),
    };
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    try {
      const seeder = new PermissionSeeder(repository as unknown as Repository<Permission>);
      await seeder.run();
      await seeder.run();
      expect(repository.save).toHaveBeenCalledTimes(1);
      expect(repository.save).toHaveBeenCalledWith({
        name: 'attendance.check-in',
        description: 'Register own attendance in an open geolocation session',
      });
    } finally {
      log.mockRestore();
    }
  });
});
