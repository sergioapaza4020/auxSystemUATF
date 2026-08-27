import AppDataSource from './datasource';
import { PermissionSeeder } from './seeders/permissions.seeder';
import { Permission } from 'src/entities/permissions/permissions.entity';
import { Faculty } from 'src/entities/faculties/faculties.entity';
import { FacultySeeder } from './seeders/faculties.seeder';
import { GradeItem } from 'src/entities/grade-items/grade-items.entity';
import { GradeItemSeeder } from './seeders/grade-items.seeder';
import { GradeSchemeSeeder } from './seeders/grade-schemes.seeder';
import { GradeScheme } from 'src/entities/grade-schemes/grade-schemes.entity';
import { GradeSchemeDetailSeeder } from './seeders/grade-scheme-details.seeder';
import { GradeSchemeDetail } from 'src/entities/grade-scheme-detail/grade-scheme-detail.entity';
import { CourseSeeder } from './seeders/courses.seeder';
import { Course } from 'src/entities/courses/courses.entity';
import { Career } from 'src/entities/careers/careers.entity';
import { CareerSeeder } from './seeders/careers.seeder';
import { Role } from 'src/entities/roles/roles.entity';
import { RoleSeeder } from './seeders/roles.seeder';
import { UserSeeder } from './seeders/users.seeder';
import { User } from 'src/entities/users/users.entity';
import { SemesterSeeder } from './seeders/semesters.seeder';
import { Semester } from 'src/entities/semesters/semester.entity';
import { EnrollmentSeeder } from './seeders/enrollments.seeder';
import { Enrollment } from 'src/entities/enrollments/enrollments.entity';

async function seed() {
  await AppDataSource.initialize();

  console.log('Database connected');

  await new PermissionSeeder(AppDataSource.getRepository(Permission)).run();
  await new FacultySeeder(AppDataSource.getRepository(Faculty)).run();
  await new GradeItemSeeder(AppDataSource.getRepository(GradeItem)).run();
  await new GradeSchemeSeeder(AppDataSource.getRepository(GradeScheme)).run();
  await new SemesterSeeder(AppDataSource.getRepository(Semester)).run();
  await new GradeSchemeDetailSeeder(
    AppDataSource.getRepository(GradeSchemeDetail),
    AppDataSource.getRepository(GradeScheme),
    AppDataSource.getRepository(GradeItem),
  ).run();
  await new CareerSeeder(
    AppDataSource.getRepository(Career),
    AppDataSource.getRepository(Faculty),
  ).run();
  await new CourseSeeder(
    AppDataSource.getRepository(Course),
    AppDataSource.getRepository(Career),
    AppDataSource.getRepository(GradeScheme),
  ).run();
  await new RoleSeeder(
    AppDataSource.getRepository(Role),
    AppDataSource.getRepository(Permission),
  ).run();
  await new UserSeeder(
    AppDataSource.getRepository(User),
    AppDataSource.getRepository(Role),
    AppDataSource.getRepository(Career),
  ).run();
  await new EnrollmentSeeder(
    AppDataSource.getRepository(Enrollment),
    AppDataSource.getRepository(User),
    AppDataSource.getRepository(Course),
    AppDataSource.getRepository(Semester),
  ).run();
  await AppDataSource.destroy();

  console.log('Seed completed');
}

void seed();
