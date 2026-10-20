import { INestApplication, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import type { NextFunction, Request, Response } from 'express';
import type { Server } from 'node:http';
import request from 'supertest';
import { EnrollmentImportController } from 'src/controllers/enrollments/enrollment-import.controller';
import { CareerStudentImportController } from 'src/controllers/careers/career-student-import.controller';
import { EnrollmentImportService } from 'src/services/enrollments/enrollment-import.service';
import { CareerStudentImportService } from 'src/services/careers/career-student-import.service';
import { createValidationPipe } from '@core/pipes/validation.pipe';
import { ResponseInterceptor } from '@core/interceptors/response/response.interceptor';
import { PermissionsGuard } from '@core/guards/permissions/permissions.guard';
const id = '00000000-0000-4000-8000-000000000001';
const page = {
  operationId: id,
  total: 100,
  valid: 99,
  invalid: 1,
  data: [{ row: 2, ru: '001', status: 'VALID', errors: [] }],
  meta: { page: 1, limit: 25, total: 100, totalPages: 4 },
};
describe.each(['enrollment', 'career'] as const)('%s import HTTP contract', (kind) => {
  let app: INestApplication;
  const actor = {
    idUser: 9,
    roles: ['ADMIN'],
    permissions: ['enrollment.create', 'career.update'],
  };
  const service = {
    preview: jest.fn().mockResolvedValue(page),
    getPreview: jest.fn().mockResolvedValue(page),
    status: jest.fn().mockResolvedValue({ operationId: id, status: 'COMPLETED' }),
    import: jest.fn().mockResolvedValue({ imported: 100, total: 100 }),
  };
  const path =
    kind === 'enrollment' ? '/api/enrollments/import' : '/api/careers/10/students/import';
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [
        kind === 'enrollment' ? EnrollmentImportController : CareerStudentImportController,
      ],
      providers: [
        {
          provide: kind === 'enrollment' ? EnrollmentImportService : CareerStudentImportService,
          useValue: service,
        },
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
  afterAll(async () => {
    await app.close();
  });
  beforeEach(() => {
    jest.clearAllMocks();
    actor.permissions = ['enrollment.create', 'career.update'];
  });
  it('returns the same nested preview contract for POST and subsequent GET', async () => {
    let post = request(app.getHttpServer() as Server).post(`${path}/preview`);
    if (kind === 'enrollment') post = post.field('courseId', '10').field('semesterId', '20');
    const preview = await post
      .attach('file', Buffer.from('stub workbook'), 'students.xlsx')
      .expect(200);
    expect(preview.body).toMatchObject({ status: true, data: page });
    const response = await request(app.getHttpServer() as Server)
      .get(`${path}/preview/${id}?page=2&limit=50&status=invalid&search=Ana`)
      .expect(200);
    expect(response.body).toMatchObject({ status: true, data: page });
    expect(service.getPreview).toHaveBeenCalledWith(
      ...(kind === 'enrollment'
        ? [id, actor, { page: 2, limit: 50, status: 'invalid', search: 'Ana' }]
        : [id, 10, 9, { page: 2, limit: 50, status: 'invalid', search: 'Ana' }]),
    );
  });
  it('executes with just the operation ID, stripping forged row arrays and replacement context', async () => {
    await request(app.getHttpServer() as Server)
      .post(path)
      .send({
        operationId: id,
        rows: [{ studentId: 999 }],
        courseId: 999,
        semesterId: 999,
        careerId: 999,
      })
      .expect(201);
    expect(service.import).toHaveBeenCalledWith(
      ...(kind === 'enrollment' ? [id, actor] : [id, 10, 9]),
    );
  });
  it('validates UUID, page size and permission for preview/status/execute', async () => {
    await request(app.getHttpServer() as Server)
      .get(`${path}/preview/${id}?limit=101`)
      .expect(400);
    await request(app.getHttpServer() as Server)
      .get(`${path}/preview/not-uuid`)
      .expect(400);
    await request(app.getHttpServer() as Server)
      .post(path)
      .send({ rows: [] })
      .expect(400);
    actor.permissions = [];
    await request(app.getHttpServer() as Server)
      .get(`${path}/preview/${id}`)
      .expect(403);
    await request(app.getHttpServer() as Server)
      .get(`${path}/${id}/status`)
      .expect(403);
    await request(app.getHttpServer() as Server)
      .post(path)
      .send({ operationId: id })
      .expect(403);
  });
  it('propagates an ownership rejection without exposing preview data', async () => {
    service.getPreview.mockRejectedValueOnce(new NotFoundException());
    await request(app.getHttpServer() as Server)
      .get(`${path}/preview/${id}`)
      .expect(404);
  });
});
