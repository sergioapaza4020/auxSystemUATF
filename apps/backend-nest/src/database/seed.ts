import { AppDataSource } from './datasource';
import { PermissionSeeder } from './seeders/permissions.seeder';
import { Permission } from 'src/entities/permissions/permissions.entity';
import { Faculty } from 'src/entities/faculties/faculties.entity';
import { FacultySeeder } from './seeders/faculties.seeder';
import { GradeItem } from 'src/entities/grade-items/grade-items.entity';
import { GradeItemSeeder } from './seeders/grade-items.seeder';
import { GradeSchemeSeeder } from './seeders/grade-schemes.seeder';
import { GradeScheme } from 'src/entities/grade-schemes/grade-schemes.entity';

async function seed() {
  await AppDataSource.initialize();

  console.log('Database connected');

  new PermissionSeeder(AppDataSource.getRepository(Permission)).run();
  new FacultySeeder(AppDataSource.getRepository(Faculty)).run();
  new GradeItemSeeder(AppDataSource.getRepository(GradeItem)).run();
  new GradeSchemeSeeder(AppDataSource.getRepository(GradeScheme)).run();

  await AppDataSource.destroy();

  console.log('Seed completed');
}

void seed();
