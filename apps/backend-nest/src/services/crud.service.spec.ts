import { BadRequestException, ConflictException, ForbiddenException, Type } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import * as bcrypt from 'bcrypt';
import { CourseRelations } from '@common/enums/courseRelations';
import { SemesterNumber } from '@common/enums/semesterNumber';
import { AttendanceStatus } from '@common/enums/attendanceStatus';
import { Career } from 'src/entities/careers/careers.entity';
import { Course } from 'src/entities/courses/courses.entity';
import { GradeItem } from 'src/entities/grade-items/grade-items.entity';
import { Permission } from 'src/entities/permissions/permissions.entity';
import { Semester } from 'src/entities/semesters/semester.entity';
import { User } from 'src/entities/users/users.entity';
import { Enrollment } from 'src/entities/enrollments/enrollments.entity';
import { GradeScheme } from 'src/entities/grade-schemes/grade-schemes.entity';
import { GradeSchemeDetail } from 'src/entities/grade-scheme-detail/grade-scheme-detail.entity';
import { AttendanceSession } from 'src/entities/attendance/attendance-session.entity';
import { Attendance } from 'src/entities/attendance/attendance.entity';
import { AttendanceSaveDto } from 'src/dtos/attendances/attendance-save.dto';
import { SemesterCreateDto } from 'src/dtos/semesters/semesters.dto';
import { UserUpdateDto } from 'src/dtos/users/users-update.dto';
import { CareersService } from './careers/careers.service';
import { CoursesService } from './courses/courses.service';
import { GradeItemsService } from './grade-items/grade-items.service';
import { PermissionsService } from './permissions/permissions.service';
import { SemestersService } from './semesters/semesters.service';
import { UsersService } from './users/users.service';
import { RolesService } from './roles/roles.service';
import { EnrollmentsService } from './enrollments/enrollments.service';
import { AssistantGradeSchemesService } from './grade-schemes/assistant-grade-schemes.service';
import { AttendancesService } from './attendances/attendances.service';
import { RecordStatus } from 'src/dtos/common/status-query.dto';
import { BulkOperationsService } from './bulk-operations/bulk-operations.service';

function repositoryMock() {
  return {
    createQueryBuilder: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn((data: object) => ({ ...data })),
    merge: jest.fn((target: object, ...sources: object[]) => {
      for (const source of sources) Object.assign(target, source);
      return target;
    }),
    save: jest.fn((data: object) => Promise.resolve(data)),
    delete: jest.fn().mockResolvedValue({ affected: 1 }),
    manager: { getRepository: jest.fn(), transaction: jest.fn() },
  };
}

describe('CRUD service behavior', () => {
  const entities = [
    Career,
    Course,
    GradeItem,
    Permission,
    Semester,
    User,
    Enrollment,
    GradeScheme,
    GradeSchemeDetail,
    AttendanceSession,
    Attendance,
  ];
  let repositories: Map<Type<unknown>, ReturnType<typeof repositoryMock>>;
  const repo = (entity: Type<unknown>) => repositories.get(entity)!;
  let careers: CareersService;
  let courses: CoursesService;
  let items: GradeItemsService;
  let permissions: PermissionsService;
  let semesters: SemestersService;
  let users: UsersService;
  let enrollments: EnrollmentsService;
  let schemes: AssistantGradeSchemesService;
  let attendances: AttendancesService;
  let roles: { getOneByName: jest.Mock };

  beforeEach(async () => {
    repositories = new Map(entities.map((entity) => [entity, repositoryMock()]));
    roles = { getOneByName: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [
        CareersService,
        CoursesService,
        GradeItemsService,
        PermissionsService,
        SemestersService,
        UsersService,
        EnrollmentsService,
        AssistantGradeSchemesService,
        AttendancesService,
        { provide: RolesService, useValue: roles },
        { provide: BulkOperationsService, useValue: {} },
        { provide: DataSource, useValue: {} },
        ...entities.map((entity) => ({
          provide: getRepositoryToken(entity),
          useValue: repo(entity),
        })),
      ],
    }).compile();
    careers = module.get(CareersService);
    courses = module.get(CoursesService);
    items = module.get(GradeItemsService);
    permissions = module.get(PermissionsService);
    semesters = module.get(SemestersService);
    users = module.get(UsersService);
    enrollments = module.get(EnrollmentsService);
    schemes = module.get(AssistantGradeSchemesService);
    attendances = module.get(AttendancesService);
  });

  it.each([undefined, RecordStatus.ACTIVE, RecordStatus.INACTIVE, RecordStatus.ALL])(
    'filters administrative lists by status %s',
    async (status) => {
      const services = [careers, courses, items, permissions, semesters, enrollments];
      const listEntities = [Career, Course, GradeItem, Permission, Semester, Enrollment];
      for (const [index, service] of services.entries()) {
        await service.getAll(status);
        expect(repo(listEntities[index]).find).toHaveBeenCalledWith(
          expect.objectContaining({
            where:
              status === RecordStatus.ALL ? {} : { isActive: status !== RecordStatus.INACTIVE },
          }),
        );
      }
    },
  );

  it.each([undefined, RecordStatus.ACTIVE, RecordStatus.INACTIVE, RecordStatus.ALL])(
    'paginates users with state %s and keeps metadata',
    async (status) => {
      const qb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[{ idUser: 21 }], 25]),
      };
      repo(User).createQueryBuilder.mockReturnValue(qb);
      expect(
        await users.getAll({
          page: 2,
          limit: 20,
          status,
          role: ['CUSTOM'],
          search: 'test',
          careerId: 1,
        }),
      ).toEqual({ data: [{ idUser: 21 }], meta: { page: 2, limit: 20, total: 25, totalPages: 2 } });
      expect(qb.where).toHaveBeenCalledWith(
        status === RecordStatus.ALL ? {} : { isActive: status !== RecordStatus.INACTIVE },
      );
      expect(qb.skip).toHaveBeenCalledWith(20);
      expect(qb.take).toHaveBeenCalledWith(20);
      expect(qb.orderBy).toHaveBeenCalledWith('user.idUser', 'ASC');
      expect(qb.andWhere).toHaveBeenCalledWith('roles.name IN (:...roles)', { roles: ['CUSTOM'] });
    },
  );

  it('selects the credential explicitly only for authentication', async () => {
    const qb = {
      addSelect: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({ password: 'hash' }),
    };
    repo(User).createQueryBuilder.mockReturnValue(qb);
    await users.getForAuthentication('test');
    expect(qb.addSelect).toHaveBeenCalledWith('user.password');
    expect(qb.where).toHaveBeenCalledWith(
      'user.username = :username AND user.isActive = :isActive',
      { username: 'test', isActive: true },
    );
    await users.getOneByUsername('test');
    expect(repo(User).findOne).toHaveBeenCalledWith(
      expect.objectContaining({ where: { username: 'test', isActive: true } }),
    );
    expect(repo(User).createQueryBuilder).toHaveBeenCalledTimes(1);
  });

  it('persists careers with their faculty, director and members', async () => {
    const relations = repositoryMock();
    relations.findOne.mockResolvedValueOnce({ idFaculty: 2 }).mockResolvedValueOnce({ idUser: 3 });
    relations.find.mockResolvedValue([{ idUser: 4 }]);
    repo(Career).manager.getRepository.mockReturnValue(relations);
    await careers.create({ name: 'Engineering', idFaculty: 2, idDirector: 3, idMembers: [4] }, 10);
    expect(repo(Career).save).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Engineering',
        createdBy: 10,
        faculty: { idFaculty: 2 },
        director: { idUser: 3 },
        members: [{ idUser: 4 }],
      }),
    );
  });

  it('rejects an unknown career member without saving', async () => {
    repo(Career).findOne.mockResolvedValue({ idCareer: 1 });
    const relations = repositoryMock();
    relations.find.mockResolvedValue([]);
    repo(Career).manager.getRepository.mockReturnValue(relations);
    await expect(careers.update(1, { idMembers: [99] })).rejects.toThrow(BadRequestException);
    expect(repo(Career).save).not.toHaveBeenCalled();
  });

  it('persists course fields and normalizes the code used for enrollment lookup', async () => {
    await courses.create({ name: 'Math', code: ' mat101 ', group: 1 }, 10);
    expect(repo(Course).save).toHaveBeenCalledWith({
      name: 'Math',
      code: 'MAT101',
      group: 1,
      createdBy: 10,
    });
  });

  it('rejects a course update that reuses another course code', async () => {
    repo(Course)
      .findOne.mockResolvedValueOnce({ idCourse: 1 })
      .mockResolvedValueOnce({ idCourse: 2 });
    await expect(courses.update(1, { code: 'MAT101' })).rejects.toThrow(BadRequestException);
    expect(repo(Course).save).not.toHaveBeenCalled();
  });

  it('checks the submitted grade item name and saves it', async () => {
    await items.create({ name: 'Exam' }, 10);
    expect(repo(GradeItem).findOne).toHaveBeenCalledWith({ where: { name: 'Exam' } });
    expect(repo(GradeItem).save).toHaveBeenCalledWith({ name: 'Exam', createdBy: 10 });
  });

  it('updates grade items while retaining their identity', async () => {
    repo(GradeItem)
      .findOne.mockResolvedValueOnce({ idGradeItem: 1, name: 'Old' })
      .mockResolvedValueOnce(null);
    await items.update(1, { name: 'Exam' });
    expect(repo(GradeItem).save).toHaveBeenCalledWith({ idGradeItem: 1, name: 'Exam' });
  });

  it('checks normalized permission names before inserting', async () => {
    repo(Permission).findOne.mockResolvedValue({ idPermission: 1 });
    await expect(
      permissions.create({ name: ' User Update ', description: 'Update' }, 10),
    ).rejects.toThrow(BadRequestException);
    expect(repo(Permission).findOne).toHaveBeenCalledWith({ where: { name: 'user.update' } });
    expect(repo(Permission).save).not.toHaveBeenCalled();
  });

  it('allows updating a permission without treating its own name as a duplicate', async () => {
    repo(Permission).findOne.mockResolvedValue({ idPermission: 1, name: 'user.update' });
    await permissions.update(1, { name: 'User Update', description: 'New description' });
    expect(repo(Permission).save).toHaveBeenCalledWith(
      expect.objectContaining({
        idPermission: 1,
        name: 'user.update',
        description: 'New description',
      }),
    );
  });

  it('validates semester date ordering after merging a partial update', async () => {
    repo(Semester).findOne.mockResolvedValue({
      idSemester: 1,
      startDate: new Date('2026-02-01'),
      endDate: new Date('2026-06-01'),
    });
    await expect(semesters.update(1, { startDate: new Date('2026-07-01') })).rejects.toThrow(
      BadRequestException,
    );
    expect(repo(Semester).save).not.toHaveBeenCalled();
  });

  it('rejects a duplicate semester period and year', async () => {
    repo(Semester)
      .findOne.mockResolvedValueOnce({
        idSemester: 1,
        year: 2026,
        period: SemesterNumber.I,
        startDate: new Date('2026-02-01'),
        endDate: new Date('2026-06-01'),
      })
      .mockResolvedValueOnce({ idSemester: 2 });
    await expect(semesters.update(1, { year: 2027 })).rejects.toThrow(ConflictException);
  });

  it('hashes an updated password, preserves omitted data and does not expose the hash', async () => {
    repo(User).findOne.mockResolvedValue({
      idUser: 1,
      email: 'a@example.com',
      name: 'Alice',
      password: 'old',
    });
    // Match TypeORM merge semantics for undefined optional properties.
    repo(User).merge.mockImplementation((target, ...sources) => {
      for (const source of sources)
        for (const [key, value] of Object.entries(source) as [string, unknown][]) {
          if (value !== undefined) Object.assign(target, { [key]: value });
        }
      return target;
    });
    const result = await users.update(1, { password: 'new-secret' });
    const saved = repo(User).save.mock.calls[0][0] as User;
    expect(await bcrypt.compare('new-secret', saved.password)).toBe(true);
    expect(result).toMatchObject({ idUser: 1, email: 'a@example.com', name: 'Alice' });
    expect(result).not.toHaveProperty('password');
  });

  it('rejects duplicate user emails without saving', async () => {
    repo(User).findOne.mockResolvedValueOnce({ idUser: 1 }).mockResolvedValueOnce({ idUser: 2 });
    await expect(users.update(1, { email: 'taken@example.com' })).rejects.toThrow(
      BadRequestException,
    );
    expect(repo(User).save).not.toHaveBeenCalled();
  });

  it('assigns the requested roles when creating a user', async () => {
    roles.getOneByName.mockResolvedValue({ idRole: 1, name: 'STUDENT' });
    await users.create({
      email: 'a@example.com',
      username: 'alice',
      name: 'Alice',
      lastname: 'Doe',
      ci: '1',
      ru: '1',
      password: 'secret',
      roleNames: ['student'],
    });
    expect(repo(User).save).toHaveBeenCalledWith(
      expect.objectContaining({ roles: [{ idRole: 1, name: 'STUDENT' }] }),
    );
  });

  it('soft deletes enrollments instead of deleting academic history', async () => {
    repo(Enrollment).findOne.mockResolvedValue({ idEnrollment: 1, isActive: true });
    await enrollments.delete(1);
    expect(repo(Enrollment).save).toHaveBeenCalledWith({ idEnrollment: 1, isActive: false });
    expect(repo(Enrollment).delete).not.toHaveBeenCalled();
  });

  it('validates the requested role when editing an enrollment', async () => {
    repo(Enrollment).findOne.mockResolvedValue({
      idEnrollment: 1,
      user: { username: 'alice' },
      semester: { period: SemesterNumber.I, year: 2026 },
      course: { code: 'MAT101' },
      role: CourseRelations.STUDENT,
    });
    repo(User).findOne.mockResolvedValue({
      username: 'alice',
      roles: [{ name: CourseRelations.STUDENT }],
    });
    repo(Semester).findOne.mockResolvedValue({ idSemester: 1 });
    repo(Course).findOne.mockResolvedValue({ idCourse: 1 });
    await expect(enrollments.update(1, { role: CourseRelations.ASSISTANT })).rejects.toThrow(
      BadRequestException,
    );
    expect(repo(Enrollment).save).not.toHaveBeenCalled();
  });

  it.each([0, 1])(
    'only reassigns enrollments without academic records (count=%i)',
    async (count) => {
      repo(Enrollment)
        .findOne.mockResolvedValueOnce({
          idEnrollment: 1,
          user: { idUser: 1, username: 'alice' },
          semester: { idSemester: 1, period: SemesterNumber.I, year: 2026 },
          course: { idCourse: 1, code: 'MAT101' },
          role: CourseRelations.STUDENT,
        })
        .mockResolvedValueOnce(null);
      repo(User).findOne.mockResolvedValue({
        idUser: 2,
        username: 'bob',
        roles: [{ name: CourseRelations.STUDENT }],
      });
      repo(Semester).findOne.mockResolvedValue({ idSemester: 1 });
      repo(Course).findOne.mockResolvedValue({ idCourse: 1 });
      repo(Enrollment).manager.getRepository.mockReturnValue({
        countBy: jest.fn().mockResolvedValue(count),
      });
      if (count > 0) {
        await expect(enrollments.update(1, { username: 'bob' })).rejects.toThrow(ConflictException);
        expect(repo(Enrollment).save).not.toHaveBeenCalled();
      } else {
        await enrollments.update(1, { username: 'bob' });
        const saved = repo(Enrollment).save.mock.calls[0][0] as Enrollment;
        expect(saved.idEnrollment).toBe(1);
        expect(saved.user.idUser).toBe(2);
      }
    },
  );

  it('requires ownership and an active assistant enrollment when deleting a scheme', async () => {
    repo(GradeScheme).findOne.mockResolvedValue({ idGradeScheme: 1, isActive: true });
    await schemes.delete(7, 1);
    expect(repo(GradeScheme).findOne).toHaveBeenCalledWith({
      where: {
        idGradeScheme: 1,
        isActive: true,
        assistantEnrollment: {
          user: { idUser: 7 },
          role: CourseRelations.ASSISTANT,
          isActive: true,
        },
      },
    });
    expect(repo(GradeScheme).save).toHaveBeenCalledWith({ idGradeScheme: 1, isActive: false });
  });

  it('rejects deleting another assistant attendance session', async () => {
    repo(AttendanceSession).findOne.mockResolvedValue({
      assistantEnrollment: { user: { idUser: 8 }, isActive: true, role: CourseRelations.ASSISTANT },
    });
    await expect(attendances.deleteSession(7, 1)).rejects.toThrow(ForbiddenException);
    expect(repo(AttendanceSession).manager.transaction).not.toHaveBeenCalled();
  });

  it('rejects changing a session to a date already used by the same assistant', async () => {
    repo(AttendanceSession)
      .findOne.mockResolvedValueOnce({
        idAttendanceSession: 1,
        assistantEnrollment: {
          idEnrollment: 3,
          user: { idUser: 7 },
          isActive: true,
          role: CourseRelations.ASSISTANT,
        },
      })
      .mockResolvedValueOnce({ idAttendanceSession: 2 });
    await expect(attendances.updateSession(7, 1, { date: '2026-09-25' })).rejects.toThrow(
      ConflictException,
    );
    expect(repo(AttendanceSession).save).not.toHaveBeenCalled();
  });

  it('deletes session attendance records and their parent inside one transaction', async () => {
    repo(AttendanceSession).findOne.mockResolvedValue({
      assistantEnrollment: { user: { idUser: 7 }, isActive: true, role: CourseRelations.ASSISTANT },
    });
    const manager = { getRepository: jest.fn((entity: Type<unknown>) => repo(entity)) };
    repo(AttendanceSession).manager.transaction.mockImplementation(
      (work: (value: typeof manager) => Promise<void>) => work(manager),
    );
    await attendances.deleteSession(7, 1);
    expect(repo(Attendance).delete).toHaveBeenCalledWith({
      attendanceSession: { idAttendanceSession: 1 },
    });
    expect(repo(AttendanceSession).delete).toHaveBeenCalledWith({ idAttendanceSession: 1 });
  });

  it('limits individual attendance deletion to the authorized session', async () => {
    repo(AttendanceSession).findOne.mockResolvedValue({
      assistantEnrollment: { user: { idUser: 7 }, isActive: true, role: CourseRelations.ASSISTANT },
    });
    await attendances.deleteAttendance(7, 1, 5);
    expect(repo(Attendance).delete).toHaveBeenCalledWith({
      attendanceSession: { idAttendanceSession: 1 },
      enrollment: { idEnrollment: 5 },
    });
  });

  it('validates nested attendance records and keeps them when whitelisting', async () => {
    const valid = plainToInstance(AttendanceSaveDto, {
      attendances: [{ enrollmentId: 1, status: AttendanceStatus.PRESENT }],
    });
    expect(await validate(valid, { whitelist: true })).toHaveLength(0);
    expect(valid.attendances).toHaveLength(1);
    const invalid = plainToInstance(AttendanceSaveDto, {
      attendances: [{ enrollmentId: -1, status: 'invalid' }],
    });
    expect((await validate(invalid)).length).toBeGreaterThan(0);
  });

  it('transforms JSON semester dates into valid Date values', async () => {
    const dto = plainToInstance(SemesterCreateDto, {
      year: 2026,
      period: SemesterNumber.I,
      startDate: '2026-02-01',
      endDate: '2026-06-01',
    });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.startDate).toBeInstanceOf(Date);
  });

  it('allows omitted user fields but rejects null values and role changes', async () => {
    expect(await validate(plainToInstance(UserUpdateDto, { name: 'Alice' }))).toHaveLength(0);
    expect(
      (await validate(plainToInstance(UserUpdateDto, { password: null }))).length,
    ).toBeGreaterThan(0);
    expect(
      (
        await validate(plainToInstance(UserUpdateDto, { roleNames: ['ADMIN'] }), {
          whitelist: true,
          forbidNonWhitelisted: true,
        })
      ).length,
    ).toBeGreaterThan(0);
  });
});
