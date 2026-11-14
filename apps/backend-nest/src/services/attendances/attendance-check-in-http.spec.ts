import { Server } from 'node:http';
import { ForbiddenException, HttpStatus, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { JwtStrategy } from '@core/strategies/jwt/jwt.strategy';
import { JwtAuthGuard } from '@core/guards/auth/auth.guard';
import { PermissionsGuard } from '@core/guards/permissions/permissions.guard';
import { createValidationPipe } from '@core/pipes/validation.pipe';
import { HttpExceptionFilter } from '@core/filters/http-exception/http-exception.filter';
import { ResponseInterceptor } from '@core/interceptors/response/response.interceptor';
import { SessionsService } from 'src/services/sessions/sessions.service';
import { AttendancesController } from 'src/controllers/attendances/attendances.controller';
import { rolesData } from 'src/database/data/roles.data';
import { AttendanceCheckInException } from '@common/errors/attendance-check-in.exception';
import { AttendanceCheckInCode as Code } from '@common/enums/attendanceCheckInCode';
import { AttendancesService } from './attendances.service';

describe('Student check-in HTTP, signed JWTs and private contracts', () => {
  let app: INestApplication<Server>;
  const jwt = new JwtService();
  const secret = 'attendance-check-in-test-only';
  const success = {
    code: 'SUCCESS',
    idAttendance: 1,
    status: 'PRESENT',
    registrationMethod: 'GEOLOCATION',
    markedAt: new Date('2026-10-25T14:00:00Z'),
  };
  const ownSession = {
    idAttendanceSession: 1,
    date: '2026-10-25',
    startsAt: '2026-10-25T14:00:00Z',
    endsAt: '2026-10-25T15:00:00Z',
    state: 'OPEN',
    isComputable: false,
    alreadyRegistered: false,
    ownStatus: null,
    ownMarkedAt: null,
  };
  const service = { checkIn: jest.fn(), getOwnEligibleSessions: jest.fn() };
  const body = { latitude: 0, longitude: 0, accuracy: 20 };
  const permissions = rolesData.find((role) => role.name === 'STUDENT')!.permissions;
  const token = (roles = ['STUDENT'], grants = permissions) =>
    jwt.sign({ idUser: 4, idSession: 1, roles, permissions: grants }, { secret, expiresIn: 60 });
  beforeAll(async () => {
    jest.replaceProperty(process, 'env', { ...process.env, JWT_ACCESS_SECRET: secret });
    const module = await Test.createTestingModule({
      controllers: [AttendancesController],
      providers: [
        { provide: AttendancesService, useValue: service },
        JwtStrategy,
        {
          provide: SessionsService,
          useValue: { assertActiveSession: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();
    app = module.createNestApplication<INestApplication<Server>>();
    app.setGlobalPrefix('api');
    app.useGlobalGuards(new JwtAuthGuard(new Reflector()), new PermissionsGuard(new Reflector()));
    app.useGlobalPipes(createValidationPipe());
    app.useGlobalInterceptors(new ResponseInterceptor());
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });
  afterAll(async () => {
    await app.close();
    jest.restoreAllMocks();
  });
  beforeEach(() => {
    jest.clearAllMocks();
    service.checkIn.mockReset().mockResolvedValue(success);
    service.getOwnEligibleSessions.mockReset().mockResolvedValue({
      data: [ownSession],
      meta: { limit: 20, hasMore: false },
    });
  });
  it.each([['STUDENT'], ['STUDENT', 'ASSISTANT']])(
    'accepts roles %j without selecting an enrollment from the client',
    async (...roles) => {
      const response = await request(app.getHttpServer())
        .post('/api/attendances/sessions/1/check-in')
        .auth(token(roles), { type: 'bearer' })
        .send(body)
        .expect(201);
      expect(service.checkIn).toHaveBeenCalledWith(4, 1, body);
      expect(response.body).toEqual({
        status: true,
        statusCode: 201,
        data: {
          ...success,
          markedAt: success.markedAt.toISOString(),
        },
      });
      expect(JSON.stringify(response.body)).not.toMatch(
        /latitude|longitude|radius|accuracy|enrollment|roles|permissions/i,
      );
    },
  );
  it('requires valid authentication and a distinct check-in permission', async () => {
    await request(app.getHttpServer())
      .post('/api/attendances/sessions/1/check-in')
      .send(body)
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/attendances/sessions/1/check-in')
      .auth(token(['ASSISTANT'], ['attendance.save']), { type: 'bearer' })
      .send(body)
      .expect(403);
    expect(service.checkIn).not.toHaveBeenCalled();
    await request(app.getHttpServer())
      .post('/api/attendances/sessions/1')
      .auth(token(), { type: 'bearer' })
      .send({ attendances: [] })
      .expect(403);
    await request(app.getHttpServer())
      .get('/api/attendances/sessions/1')
      .auth(token(), { type: 'bearer' })
      .expect(403);
  });

  it.each(['geolocation', 'activate', 'open-now', 'close', 'cancel'])(
    'denies student access to auxiliary lifecycle action %s',
    async (action) => {
      await request(app.getHttpServer())
        .patch(`/api/attendances/sessions/1/${action}`)
        .auth(token(), { type: 'bearer' })
        .send({ latitude: 0, longitude: 0 })
        .expect(403);
      expect(service.checkIn).not.toHaveBeenCalled();
    },
  );

  it('SUPERADMIN permission bypass still propagates a domain enrollment denial', async () => {
    service.checkIn.mockRejectedValueOnce(
      new AttendanceCheckInException(Code.NOT_ENROLLED, HttpStatus.FORBIDDEN),
    );
    const response = await request(app.getHttpServer())
      .post('/api/attendances/sessions/1/check-in')
      .auth(token(['SUPERADMIN'], []), { type: 'bearer' })
      .send(body)
      .expect(403);
    expect(service.checkIn).toHaveBeenCalledWith(4, 1, body);
    expect(response.body).toMatchObject({ code: Code.NOT_ENROLLED });
  });
  it.each([
    'enrollmentId',
    'idEnrollment',
    'idUser',
    'status',
    'registrationMethod',
    'markedAt',
    'markedBy',
    'distanceMeters',
  ])(
    'rejects extra %s even though the global pipe normally strips unknown properties',
    async (field) => {
      const response = await request(app.getHttpServer())
        .post('/api/attendances/sessions/1/check-in')
        .auth(token(), { type: 'bearer' })
        .send({ ...body, [field]: 99 })
        .expect(400);
      expect(response.body).toMatchObject({ code: Code.LOCATION_INVALID });
      expect(service.checkIn).not.toHaveBeenCalled();
    },
  );
  it.each([
    { latitude: 91 },
    { longitude: -181 },
    { accuracy: -1 },
    { accuracy: '20' },
    { latitude: null },
  ])('normalizes invalid coordinates into LOCATION_INVALID %#', async (values) => {
    const response = await request(app.getHttpServer())
      .post('/api/attendances/sessions/1/check-in')
      .auth(token(), { type: 'bearer' })
      .send({ ...body, ...values })
      .expect(400);
    expect(response.body).toMatchObject({ code: Code.LOCATION_INVALID });
    expect(JSON.stringify(response.body)).not.toMatch(/latitude|longitude|accuracy/i);
    expect(service.checkIn).not.toHaveBeenCalled();
  });
  it.each([Code.OUTSIDE_AREA, Code.LOW_ACCURACY] as const)(
    'preserves %s without geofence details',
    async (code) => {
      service.checkIn.mockRejectedValueOnce(
        new AttendanceCheckInException(code, HttpStatus.UNPROCESSABLE_ENTITY),
      );
      const response = await request(app.getHttpServer())
        .post('/api/attendances/sessions/1/check-in')
        .auth(token(), { type: 'bearer' })
        .send(body)
        .expect(422);
      expect(response.body).toMatchObject({ code, status: false, statusCode: 422 });
      expect(JSON.stringify(response.body)).not.toMatch(
        /"(latitude|longitude|radiusMeters|maximumAcceptedAccuracy|accuracy|enrollment)"\s*:/i,
      );
    },
  );
  it('exposes own session projection under the same permission', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/attendances/student/my/12/sessions')
      .auth(token(), { type: 'bearer' })
      .expect(200);
    expect(service.getOwnEligibleSessions).toHaveBeenCalledWith(4, 12);
    expect(response.body).toEqual({
      status: true,
      statusCode: 200,
      data: [ownSession],
      meta: { limit: 20, hasMore: false },
    });
    expect(JSON.stringify(response.body)).not.toMatch(
      /latitude|longitude|radius|accuracy|roles|permissions|assistantEnrollment/i,
    );
  });
  it('leaves legacy error envelopes unchanged when no domain code exists', async () => {
    service.getOwnEligibleSessions.mockRejectedValueOnce(new ForbiddenException('Legacy error'));
    const response = await request(app.getHttpServer())
      .get('/api/attendances/student/my/12/sessions')
      .auth(token(), { type: 'bearer' })
      .expect(403);
    expect(response.body).toMatchObject({
      status: false,
      statusCode: 403,
      message: 'Legacy error',
    });
    expect(response.body).not.toHaveProperty('code');
  });
});
