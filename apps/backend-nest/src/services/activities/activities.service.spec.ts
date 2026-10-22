import { EntityManager } from 'typeorm';
import { Course } from 'src/entities/courses/courses.entity';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Activity } from 'src/entities/activities/activity.entity';
import { Enrollment } from 'src/entities/enrollments/enrollments.entity';
import { GradeSchemeDetail } from 'src/entities/grade-scheme-detail/grade-scheme-detail.entity';
import { ACTIVITY_ORDER } from '@common/utils/activity-rules';
import { ActivitiesService } from './activities.service';

describe('ActivitiesService', () => {
  it('filters active activities and applies deterministic deadline ordering in both lists', async () => {
    const find = jest.fn().mockResolvedValue([]);
    const module = await Test.createTestingModule({
      providers: [
        ActivitiesService,
        { provide: getRepositoryToken(Activity), useValue: { find } },
        { provide: getRepositoryToken(Enrollment), useValue: {} },
        { provide: getRepositoryToken(GradeSchemeDetail), useValue: {} },
      ],
    }).compile();
    const service = module.get(ActivitiesService);
    await service.getAll();
    await service.getByGradeSchemeDetail(4);
    expect(find).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ where: { isActive: true }, order: ACTIVITY_ORDER }),
    );
    expect(find).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { isActive: true, gradeSchemeDetail: { idGradeSchemeDetail: 4 } },
        order: ACTIVITY_ORDER,
      }),
    );
  });
});

describe('Activity name validation', () => {
  async function setup(duplicate = false) {
    const assistantEnrollment = {
      idEnrollment: 12,
      isActive: true,
      user: { idUser: 1 },
      course: { idCourse: 5 },
    };
    const detail = { idGradeSchemeDetail: 4, gradeScheme: { assistantEnrollment } };
    const existing = Object.assign(new Activity(), {
      idActivity: 10,
      name: 'Práctica 1',
      gradeSchemeDetail: detail,
    });
    const query = {
      innerJoin: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getExists: jest.fn().mockResolvedValue(duplicate),
    };
    const save = jest.fn().mockImplementation((activity: Activity) => Promise.resolve(activity));
    const course = { findOneOrFail: jest.fn().mockResolvedValue({ idCourse: 5 }) };
    const repository = { createQueryBuilder: jest.fn().mockReturnValue(query), save };
    const manager = {
      getRepository: jest
        .fn()
        .mockImplementation((entity: unknown) => (entity === Course ? course : repository)),
    } as unknown as EntityManager;
    const transaction = jest
      .fn()
      .mockImplementation((callback: (manager: EntityManager) => Promise<Activity>) =>
        callback(manager),
      );
    const module = await Test.createTestingModule({
      providers: [
        ActivitiesService,
        {
          provide: getRepositoryToken(Activity),
          useValue: {
            findOne: jest.fn().mockResolvedValue(existing),
            create: (data: Partial<Activity>) => Object.assign(new Activity(), data),
            manager: { transaction },
          },
        },
        {
          provide: getRepositoryToken(Enrollment),
          useValue: { findOne: jest.fn().mockResolvedValue(assistantEnrollment) },
        },
        {
          provide: getRepositoryToken(GradeSchemeDetail),
          useValue: { findOne: jest.fn().mockResolvedValue(detail) },
        },
      ],
    }).compile();
    return { service: module.get(ActivitiesService), query, save, course, transaction, detail };
  }
  it('rejects creation for an archived criterion without saving', async () => {
    const ctx = await setup();
    Object.assign(ctx.detail, { isActive: false });
    await expect(
      ctx.service.create(5, 1, { name: 'Nueva', gradeSchemeDetailId: 4, dueDate: '2026-10-20' }),
    ).rejects.toThrow('archivado');
    expect(ctx.save).not.toHaveBeenCalled();
  });
  it('stores a trimmed name and checks uniqueness while locking the course', async () => {
    const ctx = await setup();
    const result = await ctx.service.create(5, 1, {
      name: ' Práctica 1 ',
      gradeSchemeDetailId: 4,
      dueDate: '2026-10-20',
    });
    expect(result.name).toBe('Práctica 1');
    expect(ctx.course.findOneOrFail).toHaveBeenCalledWith({
      where: { idCourse: 5 },
      lock: { mode: 'pessimistic_write' },
    });
    expect(ctx.query.andWhere).toHaveBeenCalledWith(
      'LOWER(BTRIM(activity.name)) = LOWER(BTRIM(:name))',
      { name: 'Práctica 1' },
    );
  });
  it.each(['create', 'update', 'reactivate'] as const)(
    'rejects duplicates during %s without saving',
    async (operation) => {
      const ctx = await setup(true);
      const result =
        operation === 'create'
          ? ctx.service.create(5, 1, {
              name: 'PRÁCTICA 1',
              gradeSchemeDetailId: 4,
              dueDate: '2026-10-20',
            })
          : operation === 'update'
            ? ctx.service.update(10, 1, { name: ' práctica 1 ' })
            : ctx.service.reactivate(10, 1);
      await expect(result).rejects.toThrow(
        'Ya existe una actividad con ese nombre en esta materia.',
      );
      expect(ctx.save).not.toHaveBeenCalled();
      if (operation !== 'create')
        expect(ctx.query.andWhere).toHaveBeenCalledWith('activity.idActivity != :idActivity', {
          idActivity: 10,
        });
    },
  );
  it('rejects whitespace-only names before persistence', async () => {
    const ctx = await setup();
    await expect(
      ctx.service.create(5, 1, { name: '   ', gradeSchemeDetailId: 4, dueDate: '2026-10-20' }),
    ).rejects.toThrow('El nombre de la actividad no puede estar vacío');
    expect(ctx.transaction).not.toHaveBeenCalled();
  });
});
