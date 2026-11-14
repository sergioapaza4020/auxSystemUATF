import { Server } from 'node:http';
import request from 'supertest';
import type { Request, Response, NextFunction } from 'express';
import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { AttendancesController } from 'src/controllers/attendances/attendances.controller';
import { AttendancesService } from './attendances.service';
import { PermissionsGuard } from '@core/guards/permissions/permissions.guard';
import { createValidationPipe } from '@core/pipes/validation.pipe';
import { ResponseInterceptor } from '@core/interceptors/response/response.interceptor';
import { HttpExceptionFilter } from '@core/filters/http-exception/http-exception.filter';

describe('GEO lifecycle HTTP contracts', () => {
  const result = { idAttendanceSession: 1, state: 'SCHEDULED', isComputable: false };
  const service = {
    createSession: jest.fn(),
    activateSession: jest.fn().mockResolvedValue(result),
    closeSession: jest.fn().mockResolvedValue(result),
    cancelSession: jest.fn().mockResolvedValue(result),
    configureGeolocation: jest.fn().mockResolvedValue(result),
  };
  let permissions: string[];

  async function application() {
    const module = await Test.createTestingModule({
      controllers: [AttendancesController],
      providers: [{ provide: AttendancesService, useValue: service }],
    }).compile();
    const app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.use((_req: Request, _res: Response, next: NextFunction) => {
      Object.assign(_req, { user: { idUser: 2, roles: ['ASSISTANT'], permissions } });
      next();
    });
    app.useGlobalGuards(new PermissionsGuard(new Reflector()));
    app.useGlobalPipes(createValidationPipe());
    app.useGlobalInterceptors(new ResponseInterceptor());
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
    const server: unknown = app.getHttpServer();
    if (!(server instanceof Server)) throw new Error('Expected HTTP server');
    return { app, server };
  }
  beforeEach(() => {
    jest.clearAllMocks();
    permissions = ['attendance.session.update'];
  });

  it('accepts QR creation through the validated existing endpoint', async () => {
    permissions = ['attendance.session.create'];
    service.createSession.mockResolvedValue({
      idAttendanceSession: 1,
      mode: 'QR',
      date: '2026-10-25',
      openedAt: null,
    });
    const { app, server } = await application();
    try {
      await request(server)
        .post('/api/attendances/sessions')
        .send({ enrollmentId: 10, date: '2026-10-25', mode: 'QR' })
        .expect(201);
      expect(service.createSession).toHaveBeenCalledWith(
        2,
        expect.objectContaining({ mode: 'QR' }),
      );
    } finally {
      await app.close();
    }
  });

  it.each(['activate', 'open-now', 'close', 'cancel'])(
    'binds %s without accepting client timestamps',
    async (action) => {
      const { app, server } = await application();
      try {
        const response = await request(server)
          .patch(`/api/attendances/sessions/1/${action}`)
          .send({ openedAt: '2000-01-01T00:00:00Z', closedAt: '2000-01-01T00:00:00Z' })
          .expect(200);
        expect(response.body).toEqual({ status: true, statusCode: 200, data: result });
        if (action === 'open-now') expect(service.activateSession).toHaveBeenCalledWith(2, 1, true);
        else if (action === 'activate') expect(service.activateSession).toHaveBeenCalledWith(2, 1);
        else if (action === 'close') expect(service.closeSession).toHaveBeenCalledWith(2, 1);
        else expect(service.cancelSession).toHaveBeenCalledWith(2, 1);
      } finally {
        await app.close();
      }
    },
  );
  it('strips derived fields and rejects coordinates or times without valid values', async () => {
    const { app, server } = await application();
    try {
      await request(server)
        .patch('/api/attendances/sessions/1/geolocation')
        .send({ latitude: 0, longitude: 0, state: 'OPEN', openedAt: '2000-01-01T00:00:00Z' })
        .expect(200);
      expect(service.configureGeolocation).toHaveBeenCalledWith(2, 1, {
        latitude: 0,
        longitude: 0,
      });
      for (const body of [
        { latitude: 91 },
        { radiusMeters: 0 },
        { startsAt: '2026-10-25T12:00:00' },
        { longitude: null },
      ])
        await request(server)
          .patch('/api/attendances/sessions/1/geolocation')
          .send(body)
          .expect(400);
      expect(service.configureGeolocation).toHaveBeenCalledTimes(1);
    } finally {
      await app.close();
    }
  });
  it('requires the existing update permission and protects check-in with its own permission', async () => {
    permissions = ['enrollment.get-my-enrollment'];
    const { app, server } = await application();
    try {
      await request(server).patch('/api/attendances/sessions/1/activate').send({}).expect(403);
      expect(service.activateSession).not.toHaveBeenCalled();
      await request(server).post('/api/attendances/sessions/1/check-in').send({}).expect(403);
    } finally {
      await app.close();
    }
  });
});
