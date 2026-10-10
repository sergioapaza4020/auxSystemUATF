import { Server } from 'node:http';
import request from 'supertest';
import type { Request, Response, NextFunction } from 'express';
import { Test } from '@nestjs/testing';
import { AttendancesController } from 'src/controllers/attendances/attendances.controller';
import { AttendancesService } from './attendances.service';
import { ResponseInterceptor } from '@core/interceptors/response/response.interceptor';
import { createValidationPipe } from '@core/pipes/validation.pipe';
import { AttendanceStatus as S } from '@common/enums/attendanceStatus';

describe('Attendance save HTTP contract (isolated, without database)', () => {
  it('returns HTTP 201 and wrapped confirmed records for all three statuses', async () => {
    const payload = {
      attendances: [
        { enrollmentId: 10, status: S.PRESENT, observation: null },
        { enrollmentId: 11, status: S.EXCUSED, observation: 'Cita médica' },
        { enrollmentId: 12, status: S.ABSENT, observation: null },
      ],
    };
    const records = payload.attendances.map((record) => ({
      idAttendance: record.enrollmentId,
      enrollment: { idEnrollment: record.enrollmentId },
      status: record.status,
      observation: record.observation,
    }));
    const service = { saveAttendances: jest.fn().mockResolvedValue(records) };
    const module = await Test.createTestingModule({
      controllers: [AttendancesController],
      providers: [{ provide: AttendancesService, useValue: service }],
    }).compile();
    const app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.use((req: Request, _res: Response, next: NextFunction) => {
      Object.assign(req, { user: { idUser: 2 } });
      next();
    });
    app.useGlobalPipes(createValidationPipe());
    app.useGlobalInterceptors(new ResponseInterceptor());
    try {
      await app.init();
      const server: unknown = app.getHttpServer();
      if (!(server instanceof Server)) throw new Error('Expected HTTP server');
      const response = await request(server)
        .post('/api/attendances/sessions/1')
        .send(payload)
        .expect(201);
      expect(response.body).toEqual({ status: true, statusCode: 201, data: records });
      expect(service.saveAttendances).toHaveBeenCalledWith(2, 1, payload);
    } finally {
      await app.close();
    }
  });
});
