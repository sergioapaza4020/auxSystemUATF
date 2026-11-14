import { compare } from 'bcrypt';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { DataSource, QueryFailedError } from 'typeorm';
import { createSeedTestDatabase } from '../../../test/seeders-postgres';
import { runSeeders, SeedExecutionError } from '../seed-runner';
import { SeedDataError } from '../utils/seed-integrity';
import { usersData } from '../data/users.data';
import { enrollmentsData } from '../data/enrollments.data';
import { permissionsData } from '../data/permissions.data';
import { rolesData } from '../data/roles.data';
import { UserSeeder } from './users.seeder';
import { EnrollmentSeeder } from './enrollments.seeder';
import { CourseSeeder } from './courses.seeder';
import { coursesData } from '../data/courses.data';
import { hashPassword } from '../utils/password.util';
import { User } from 'src/entities/users/users.entity';
import { Role } from 'src/entities/roles/roles.entity';
import { Permission } from 'src/entities/permissions/permissions.entity';
import { Course } from 'src/entities/courses/courses.entity';
import { Career } from 'src/entities/careers/careers.entity';
import { Faculty } from 'src/entities/faculties/faculties.entity';
import { Semester } from 'src/entities/semesters/semester.entity';
import { Enrollment } from 'src/entities/enrollments/enrollments.entity';
import { GradeScheme } from 'src/entities/grade-schemes/grade-schemes.entity';
import { GradeSchemeDetail } from 'src/entities/grade-scheme-detail/grade-scheme-detail.entity';
import { GradeItem } from 'src/entities/grade-items/grade-items.entity';
import { Activity } from 'src/entities/activities/activity.entity';
import { Grade } from 'src/entities/grades/grades.entity';
import { AttendanceSession } from 'src/entities/attendance/attendance-session.entity';
import { Attendance } from 'src/entities/attendance/attendance.entity';
import { CourseRelations } from '@common/enums/courseRelations';
import { SemesterNumber } from '@common/enums/semesterNumber';
import { AttendanceStatus } from '@common/enums/attendanceStatus';

const pgBin = process.env.SEED_TEST_PG_BIN;
const describePostgres = pgBin ? describe : describe.skip;
const demoOptions = { includeDemoData: true, environment: 'test' };

describePostgres('Seeder integrity on a verified disposable PostgreSQL cluster', () => {
  let database: Awaited<ReturnType<typeof createSeedTestDatabase>>;
  let source: DataSource;
  let quiet: jest.SpyInstance;

  async function rows<T>(sql: string, parameters?: unknown[]): Promise<T[]> {
    const result: unknown = await source.query(sql, parameters);
    if (!Array.isArray(result)) throw new Error('Expected PostgreSQL rows');
    return result as T[];
  }
  async function counts() {
    const tables = [
      'permissions',
      'roles',
      'role_permission',
      'users',
      'user_role',
      'faculties',
      'careers',
      'career_courses',
      'courses',
      'semesters',
      'grade_items',
      'grade_schemes',
      'grade_scheme_details',
      'enrollments',
      'activities',
      'grades',
      'attendance_sessions',
      'attendances',
    ];
    return Promise.all(
      tables.map(async (table) => ({
        table,
        count: (await rows<{ count: number }>(`SELECT count(*)::int AS count FROM "${table}"`))[0]
          .count,
      })),
    );
  }
  function enrollmentSeeder() {
    return new EnrollmentSeeder(
      source.getRepository(Enrollment),
      source.getRepository(User),
      source.getRepository(Course),
      source.getRepository(Semester),
    );
  }
  function userSeeder() {
    return new UserSeeder(
      source.getRepository(User),
      source.getRepository(Role),
      source.getRepository(Career),
    );
  }

  beforeAll(async () => {
    quiet = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    database = await createSeedTestDatabase(pgBin!);
    source = database.source;
    // These are the actual project migrations, not an entity-generated schema.
    expect((await source.runMigrations({ transaction: 'each' })).length).toBe(22);
    expect(await source.showMigrations()).toBe(false);
  }, 90000);
  afterAll(async () => {
    await database?.close();
    quiet?.mockRestore();
  }, 45000);

  it('completes the full dependency chain on an empty migrated database', async () => {
    await runSeeders(source, demoOptions);
    expect(await source.getRepository(User).count()).toBe(usersData.length);
    expect(await source.getRepository(Enrollment).count()).toBe(enrollmentsData.length);
    expect(await source.getRepository(Permission).count()).toBe(permissionsData.length);
    expect(await source.getRepository(Role).count()).toBe(rolesData.length);
    for (const data of rolesData) {
      const role = await source
        .getRepository(Role)
        .findOneOrFail({ where: { name: data.name }, relations: { permissions: true } });
      expect(new Set(role.permissions.map((permission) => permission.name))).toEqual(
        new Set(data.permissions),
      );
    }
    const seeded = await source.getRepository(User).findOneOrFail({
      where: { username: usersData[0].username },
      select: { idUser: true, password: true },
    });
    expect(await compare(usersData[0].password, seeded.password)).toBe(true);
    const invalid = await rows<{ count: number }>(`SELECT count(*)::int AS count FROM enrollments e
      LEFT JOIN users u ON u.id_user=e.id_user LEFT JOIN courses c ON c.id_course=e.id_course
      LEFT JOIN semesters s ON s.id_semester=e.id_semester
      WHERE u.id_user IS NULL OR c.id_course IS NULL OR s.id_semester IS NULL`);
    expect(invalid[0].count).toBe(0);
  }, 30000);

  it('reproduces the original timestamp-dependent lookup and 23505, then reuses the enrollment by FK identity', async () => {
    const data = enrollmentsData[0];
    const user = await source
      .getRepository(User)
      .findOneOrFail({ where: { username: data.user }, relations: { roles: true } });
    await source.query(
      `UPDATE users SET updated_at=TIMESTAMP '2026-01-01 00:00:00.123456' WHERE id_user=$1`,
      [user.idUser],
    );
    const loaded = await source
      .getRepository(User)
      .findOneOrFail({ where: { idUser: user.idUser }, relations: { roles: true } });
    const course = await source
      .getRepository(Course)
      .findOneByOrFail({ code: data.courseCode, group: data.courseGroup });
    const semester = await source
      .getRepository(Semester)
      .findOneByOrFail({ period: SemesterNumber.II, year: 2026 });
    const repository = source.getRepository(Enrollment);
    const before = await repository.count();
    expect(await repository.findOne({ where: { user: loaded, course, semester } })).toBeNull();
    let failure: unknown;
    try {
      await repository.save(repository.create({ user: loaded, course, semester, role: data.role }));
    } catch (error: unknown) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(QueryFailedError);
    const driver = (failure as QueryFailedError).driverError as Error & {
      code: string;
      constraint: string;
    };
    expect(driver.code).toBe('23505');
    expect(driver.constraint).toBe('UQ_f0c733a26362d184c12a54f9249');
    await enrollmentSeeder().create(data);
    expect(await repository.count()).toBe(before);
  });

  it('runs twice more without duplicating any entity or junction relation', async () => {
    const before = await counts();
    await runSeeders(source, demoOptions);
    await runSeeders(source, demoOptions);
    expect(await counts()).toEqual(before);
  }, 30000);

  it('rolls back the failing seeder, stops dependent steps and recovers without cleanup', async () => {
    const before = await counts();
    const fault = jest.spyOn(UserSeeder.prototype, 'create');
    const create = fault.getMockImplementation()!;
    fault.mockImplementationOnce(async function (this: UserSeeder, data) {
      await create.call(this, {
        ...data,
        username: 'isolated-interrupted',
        email: 'isolated-interrupted@example.test',
        ci: 'AUDIT-INTERRUPTED',
        ru: undefined,
      });
      throw new SeedDataError('Fallo controlado de prueba.');
    });
    const log = jest.fn();
    try {
      await expect(runSeeders(source, { ...demoOptions, log })).rejects.toThrow(SeedExecutionError);
    } finally {
      fault.mockRestore();
    }
    expect(await counts()).toEqual(before);
    expect(await source.getRepository(User).existsBy({ username: 'isolated-interrupted' })).toBe(
      false,
    );
    expect(log).not.toHaveBeenCalledWith('Iniciando EnrollmentSeeder');
    await runSeeders(source, demoOptions);
    expect(await counts()).toEqual(before);
  }, 30000);

  it('reuses the same user after a personal email change and rejects split identity conflicts before INSERT', async () => {
    const before = await source.getRepository(User).count();
    const data = usersData[0];
    await userSeeder().create({ ...data, email: 'alternative-seed@example.test' });
    await expect(userSeeder().create({ ...data, ci: 'AUDIT-OTHER-IDENTITY' })).rejects.toThrow(
      SeedDataError,
    );
    await expect(userSeeder().create({ ...data, email: usersData[1].email })).rejects.toThrow(
      SeedDataError,
    );
    expect(await source.getRepository(User).count()).toBe(before);
  });

  it('preserves custom users, password, roles, permissions, parents, academic configuration, grades and GEO-compatible attendance', async () => {
    const manager = source.manager;
    const customPermission = await manager
      .getRepository(Permission)
      .save({ name: 'audit.custom.keep' });
    const customRole = await manager
      .getRepository(Role)
      .save({ name: 'AUDIT_CUSTOM', description: 'Custom', permissions: [customPermission] });
    const studentRole = await manager.getRepository(Role).findOneByOrFail({ name: 'STUDENT' });
    await manager
      .createQueryBuilder()
      .relation(Role, 'permissions')
      .of(studentRole)
      .add(customPermission);
    const user = await manager.getRepository(User).findOneOrFail({
      where: { username: usersData[0].username },
      select: { idUser: true, password: true },
    });
    const changedPasswordHash = await hashPassword(randomUUID());
    await manager.getRepository(User).update(user.idUser, {
      password: changedPasswordHash,
      email: 'custom-preserved@example.test',
      name: 'Custom preserved',
    });
    await manager.createQueryBuilder().relation(User, 'roles').of(user).add(customRole);
    const faculty = await manager.getRepository(Faculty).findOneOrFail({ where: {} });
    await manager.getRepository(Faculty).update(faculty.idFaculty, { dean: user });
    const career = await manager.getRepository(Career).findOneOrFail({ where: {} });
    await manager.getRepository(Career).update(career.idCareer, { director: user });
    const course = await manager
      .getRepository(Course)
      .save({ code: 'AUDIT-KEEP', name: 'Custom academic course', group: 7, career: [career] });
    const semester = await manager
      .getRepository(Semester)
      .findOneByOrFail({ period: SemesterNumber.II, year: 2026 });
    const studentData = usersData.find((item) => item.roles.includes('STUDENT'))!;
    const assistantData = usersData.find((item) => item.roles.includes('ASSISTANT'))!;
    const student = await manager
      .getRepository(User)
      .findOneByOrFail({ username: studentData.username });
    const assistant = await manager
      .getRepository(User)
      .findOneByOrFail({ username: assistantData.username });
    const enrollment = await manager
      .getRepository(Enrollment)
      .save({ course, semester, user: student, role: CourseRelations.STUDENT });
    const assistantEnrollment = await manager
      .getRepository(Enrollment)
      .save({ course, semester, user: assistant, role: CourseRelations.ASSISTANT });
    const scheme = await manager.getRepository(GradeScheme).save({
      name: 'Custom academic scheme',
      description: 'Preserved',
      assistantEnrollment,
      assistantPercentage: 20,
    });
    const gradeItem = await manager.getRepository(GradeItem).findOneByOrFail({ name: 'Prácticas' });
    const detail = await manager
      .getRepository(GradeSchemeDetail)
      .save({ gradeScheme: scheme, gradeItem, percentage: 100, order: 1 });
    const activity = await manager
      .getRepository(Activity)
      .save({ name: 'Historical', gradeSchemeDetail: detail, dueDate: '2026-11-11' });
    await manager
      .getRepository(Grade)
      .save({ enrollment, activity, gradeSchemeDetail: detail, score: 87 });
    const session = await manager
      .getRepository(AttendanceSession)
      .save({ assistantEnrollment, date: new Date('2026-11-11') });
    await manager.getRepository(Attendance).save({
      attendanceSession: session,
      enrollment,
      status: AttendanceStatus.PRESENT,
      observation: 'Preserved',
    });
    // A renamed criterion represents an edited distribution; seeding must not refill the old criterion.
    const editedItem = await manager.getRepository(GradeItem).save({ name: 'Custom criterion' });
    const existingDetail = await manager
      .getRepository(GradeSchemeDetail)
      .findOneOrFail({ where: {} });
    await manager
      .getRepository(GradeSchemeDetail)
      .update(existingDetail.idGradeSchemeDetail, { gradeItem: editedItem });
    const beforeCounts = await counts();
    const protectedTables = [
      'users',
      'user_role',
      'faculties',
      'careers',
      'courses',
      'enrollments',
      'grade_schemes',
      'grade_scheme_details',
      'activities',
      'grades',
      'attendance_sessions',
      'attendances',
    ];
    async function snapshot() {
      return Promise.all(
        protectedTables.map((table) => rows(`SELECT * FROM "${table}" ORDER BY 1`)),
      );
    }
    const before = JSON.stringify(await snapshot());
    await runSeeders(source, demoOptions);
    expect(JSON.stringify(await snapshot()) === before).toBe(true);
    expect(await counts()).toEqual(beforeCounts);
    const after = await manager
      .getRepository(User)
      .findOneOrFail({ where: { idUser: user.idUser }, select: { idUser: true, password: true } });
    expect(after.password === changedPasswordHash).toBe(true);
    const seededRole = await manager
      .getRepository(Role)
      .findOneOrFail({ where: { name: 'STUDENT' }, relations: { permissions: true } });
    expect(
      seededRole.permissions.some((permission) => permission.name === 'audit.custom.keep'),
    ).toBe(true);
  }, 30000);

  it('adds a newly missing check-in permission without removing the former custom assignment', async () => {
    const permission = await source
      .getRepository(Permission)
      .findOneByOrFail({ name: 'attendance.check-in' });
    await source
      .getRepository(Permission)
      .update(permission.idPermission, { name: 'audit.former-check-in' });
    await runSeeders(source, demoOptions);
    const role = await source
      .getRepository(Role)
      .findOneOrFail({ where: { name: 'STUDENT' }, relations: { permissions: true } });
    expect(role.permissions.some((item) => item.name === 'attendance.check-in')).toBe(true);
    expect(role.permissions.some((item) => item.name === 'audit.former-check-in')).toBe(true);
    const before = await counts();
    await runSeeders(source, demoOptions);
    expect(await counts()).toEqual(before);
  }, 30000);

  it('preserves inactive and soft-deleted records rather than duplicating or reactivating them', async () => {
    const faculty = await source.getRepository(Faculty).findOneOrFail({ where: {} });
    const gradeItem = await source
      .getRepository(GradeItem)
      .findOneByOrFail({ name: 'Laboratorio' });
    const enrollment = await source.getRepository(Enrollment).findOneOrFail({ where: {} });
    const scheme = await source
      .getRepository(GradeScheme)
      .findOneByOrFail({ name: 'Evaluación teórica - experimental 002' });
    const course = await source.getRepository(Course).findOneByOrFail({
      code: enrollmentsData[0].courseCode,
      group: enrollmentsData[0].courseGroup,
    });
    const semester = await source
      .getRepository(Semester)
      .findOneByOrFail({ period: SemesterNumber.II, year: 2026 });
    const deletedAt = new Date('2026-11-01T00:00:00Z');
    await source.getRepository(Faculty).update(faculty.idFaculty, { isActive: false, deletedAt });
    await source
      .getRepository(GradeItem)
      .update(gradeItem.idGradeItem, { isActive: false, deletedAt });
    await source
      .getRepository(Enrollment)
      .update(enrollment.idEnrollment, { isActive: false, deletedAt });
    await source
      .getRepository(GradeScheme)
      .update(scheme.idGradeScheme, { isActive: false, deletedAt });
    await source.getRepository(Course).update(course.idCourse, { isActive: false, deletedAt });
    await source
      .getRepository(Semester)
      .update(semester.idSemester, { isActive: false, deletedAt });
    const before = await counts();
    await runSeeders(source, demoOptions);
    expect(await counts()).toEqual(before);
    const preserved = await Promise.all([
      source
        .getRepository(Faculty)
        .findOne({ where: { idFaculty: faculty.idFaculty }, withDeleted: true }),
      source
        .getRepository(GradeItem)
        .findOne({ where: { idGradeItem: gradeItem.idGradeItem }, withDeleted: true }),
      source
        .getRepository(Enrollment)
        .findOne({ where: { idEnrollment: enrollment.idEnrollment }, withDeleted: true }),
    ]);
    for (const record of preserved) {
      expect(record?.isActive).toBe(false);
      expect(record?.deletedAt?.getTime()).toBe(deletedAt.getTime());
    }
    const candidate = usersData.find(
      (item) => item.roles.includes('ASSISTANT') && item.username !== enrollmentsData[0].user,
    )!;
    await expect(
      enrollmentSeeder().create({ ...enrollmentsData[0], user: candidate.username }),
    ).rejects.toThrow('no se crearán relaciones nuevas');
  }, 30000);

  it('does not convert an existing participation or accept an invalid semester', async () => {
    const data = enrollmentsData[0];
    await expect(
      enrollmentSeeder().create({ ...data, role: CourseRelations.STUDENT }),
    ).rejects.toThrow('otra participación');
    await expect(enrollmentSeeder().create({ ...data, semester: 'III-2026' })).rejects.toThrow(
      'semestre inválido',
    );
  });

  it('does not create demo accounts by default and rejects demo seeding in production before writes', async () => {
    const users = jest.spyOn(UserSeeder.prototype, 'run');
    try {
      await runSeeders(source);
      expect(users).not.toHaveBeenCalled();
      const before = await counts();
      await expect(
        runSeeders(source, { includeDemoData: true, environment: 'production' }),
      ).rejects.toThrow(SeedDataError);
      expect(await counts()).toEqual(before);
    } finally {
      users.mockRestore();
    }
  }, 30000);

  it('runs the real seed entrypoint with an explicitly isolated connection and exits successfully', async () => {
    const before = await counts();
    const output = execFileSync(
      process.execPath,
      [
        require.resolve('ts-node/dist/bin'),
        '-r',
        require.resolve('tsconfig-paths/register'),
        'src/database/seed.ts',
      ],
      {
        env: {
          ...process.env,
          DATABASE_URL: `postgresql://seeders_test@127.0.0.1:${database.port}/postgres`,
          NODE_ENV: 'test',
          SEED_DEMO_DATA: 'true',
        },
        windowsHide: true,
        timeout: 45000,
        encoding: 'utf8',
        stdio: 'pipe',
      },
    );
    expect(output.includes('Seed completed')).toBe(true);
    expect(await counts()).toEqual(before);
  }, 60000);

  it('refuses ambiguous semester references instead of choosing a row arbitrarily', async () => {
    await source.getRepository(Semester).save({
      period: SemesterNumber.II,
      year: 2026,
      startDate: new Date('2026-07-27'),
      endDate: new Date('2026-12-11'),
    });
    await expect(enrollmentSeeder().create(enrollmentsData[0])).rejects.toThrow(
      'referencia ambigua',
    );
  });

  it('treats course code plus group as the destination and preserves another group', async () => {
    const data = coursesData.find((item) => item.code === enrollmentsData[0].courseCode)!;
    const seeder = new CourseSeeder(
      source.getRepository(Course),
      source.getRepository(Career),
      source.getRepository(GradeScheme),
    );
    await seeder.create({ ...data, group: 99 });
    expect(
      await source.getRepository(Course).count({ where: { code: data.code }, withDeleted: true }),
    ).toBe(2);
    const expected = await source
      .getRepository(Course)
      .findOneOrFail({ where: { code: data.code, group: data.group }, withDeleted: true });
    const reused = await source
      .getRepository(Course)
      .findOneByOrFail({ code: data.code, group: 99 });
    expect(expected.idCourse === reused.idCourse).toBe(false);
  });
});
