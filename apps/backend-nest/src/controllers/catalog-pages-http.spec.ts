import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import type { NextFunction, Request, Response } from 'express';
import type { Server } from 'node:http';
import request from 'supertest';
import { CoursesController } from './courses/courses.controller';
import { GradeSchemesController } from './grade-schemes/grade-schemes.controller';
import { EnrollmentsController } from './enrollments/enrollments.controller';
import { CareersController } from './careers/careers.controller';
import { CoursesService } from 'src/services/courses/courses.service';
import { GradeSchemesService } from 'src/services/grade-schemes/grade-schemes.service';
import { EnrollmentsService } from 'src/services/enrollments/enrollments.service';
import { CareersService } from 'src/services/careers/careers.service';
import { createValidationPipe } from '@core/pipes/validation.pipe';
import { ResponseInterceptor } from '@core/interceptors/response/response.interceptor';
import { PermissionsGuard } from '@core/guards/permissions/permissions.guard';

const meta = { page: 2, limit: 5, total: 31, totalPages: 7 };
describe('Phase 5 read HTTP contracts', () => {
  let app: INestApplication;
  const actor = { idUser: 9, roles: ['ADMIN'], permissions: [] as string[] };
  const courses = {
    getAll: jest.fn().mockResolvedValue([]),
    getPage: jest.fn().mockResolvedValue({ data: [{ idCourse: 11 }], meta }),
  };
  const schemes = {
    getAll: jest.fn().mockResolvedValue([]),
    getPage: jest.fn().mockResolvedValue({ data: [{ idGradeScheme: 11 }], meta }),
  };
  const enrollments = { getUserEnrollments: jest.fn().mockResolvedValue([]) };
  const careers = { getAll: jest.fn().mockResolvedValue([{ idCareer: 7 }]) };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [
        CoursesController,
        GradeSchemesController,
        EnrollmentsController,
        CareersController,
      ],
      providers: [
        { provide: CoursesService, useValue: courses },
        { provide: GradeSchemesService, useValue: schemes },
        { provide: EnrollmentsService, useValue: enrollments },
        { provide: CareersService, useValue: careers },
      ],
    }).compile();
    app = module.createNestApplication();
    app.use((req: Request, _res: Response, next: NextFunction) => {
      Object.assign(req, { user: actor });
      next();
    });
    app.setGlobalPrefix('api');
    app.useGlobalPipes(createValidationPipe());
    app.useGlobalInterceptors(new ResponseInterceptor());
    app.useGlobalGuards(new PermissionsGuard(new Reflector()));
    await app.init();
  });
  afterAll(async () => app.close());
  beforeEach(() => {
    jest.clearAllMocks();
    actor.permissions = [
      'course.get-all',
      'grade-scheme.get-all',
      'enrollment.get-my-enrollments',
      'career.get-all',
    ];
  });
  it.each(['courses', 'grade-schemes'])(
    'keeps legacy arrays and the existing paginated envelope for %s',
    async (path) => {
      const server = app.getHttpServer() as Server;
      const legacy = await request(server).get(`/api/${path}`).expect(200);
      expect(legacy.body).toMatchObject({ status: true, data: [] });
      expect(legacy.body).not.toHaveProperty('meta');
      const result = await request(server)
        .get(`/api/${path}?page=2&limit=5&status=inactive&search=Ana`)
        .expect(200);
      expect(result.body).toMatchObject({ status: true, meta });
      const service = path === 'courses' ? courses : schemes;
      expect(service.getPage).toHaveBeenCalledWith(
        expect.objectContaining({ page: 2, limit: 5, status: 'inactive', search: 'Ana' }),
      );
    },
  );
  it.each(['courses', 'grade-schemes'])(
    'rejects invalid pagination before service reads for %s',
    async (path) => {
      await request(app.getHttpServer() as Server)
        .get(`/api/${path}?page=0&limit=101`)
        .expect(400);
      expect(courses.getPage).not.toHaveBeenCalled();
      expect(schemes.getPage).not.toHaveBeenCalled();
    },
  );
  it.each(['courses', 'grade-schemes'])('keeps permission guards on %s', async (path) => {
    actor.permissions = [];
    await request(app.getHttpServer() as Server)
      .get(`/api/${path}?page=1`)
      .expect(403);
  });
  it('uses only scalar allowlisted global scheme sorting', async () => {
    await request(app.getHttpServer() as Server)
      .get('/api/grade-schemes?sortBy=details')
      .expect(400);
  });
  it('uses the current actor and validates the current-semester option', async () => {
    await request(app.getHttpServer() as Server)
      .get('/api/enrollments/my-enrollments?current=true&idUser=99')
      .expect(200);
    expect(enrollments.getUserEnrollments).toHaveBeenCalledWith(9, true);
    await request(app.getHttpServer() as Server)
      .get('/api/enrollments/my-enrollments?current=bad')
      .expect(400);
  });
  it('looks up one career under the unchanged list permission', async () => {
    await request(app.getHttpServer() as Server)
      .get('/api/careers?idCareer=7&status=all')
      .expect(200);
    expect(careers.getAll).toHaveBeenCalledWith('all', 7);
    await request(app.getHttpServer() as Server)
      .get('/api/careers?idCareer=-1')
      .expect(400);
  });
});
