import { In } from 'typeorm';
import { CourseRelations } from '@common/enums/courseRelations';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Server } from 'node:http';
import request from 'supertest';
import { EnrollmentsController } from './enrollments.controller';
import { EnrollmentsService } from 'src/services/enrollments/enrollments.service';
import { Enrollment } from 'src/entities/enrollments/enrollments.entity';
import { UsersService } from 'src/services/users/users.service';
import { SemestersService } from 'src/services/semesters/semesters.service';
import { CoursesService } from 'src/services/courses/courses.service';
import { JwtStrategy } from '@core/strategies/jwt/jwt.strategy';
import { JwtAuthGuard } from '@core/guards/auth/auth.guard';
import { PermissionsGuard } from '@core/guards/permissions/permissions.guard';
import { ResponseInterceptor } from '@core/interceptors/response/response.interceptor';
import { rolesData } from 'src/database/data/roles.data';
import { SessionsService } from 'src/services/sessions/sessions.service';

describe('Own enrollments with signed persona JWTs and real guards', () => {
  let app: INestApplication<Server>;
  const secret = 'own-enrollments-test-only';
  const jwt = new JwtService();
  const repository = { find: jest.fn().mockResolvedValue([{ idEnrollment: 10 }]) };
  const users = { getOneById: jest.fn().mockResolvedValue({ idUser: 5 }) };
  const semesters = { getCurrentSemester: jest.fn().mockResolvedValue({ idSemester: 20 }) };
  beforeAll(async () => {
    jest.replaceProperty(process, 'env', { ...process.env, JWT_ACCESS_SECRET: secret });
    const module = await Test.createTestingModule({
      controllers: [EnrollmentsController],
      providers: [
        EnrollmentsService,
        JwtStrategy,
        {
          provide: SessionsService,
          useValue: { assertActiveSession: jest.fn().mockResolvedValue(undefined) },
        },
        { provide: getRepositoryToken(Enrollment), useValue: repository },
        { provide: UsersService, useValue: users },
        { provide: SemestersService, useValue: semesters },
        { provide: CoursesService, useValue: {} },
      ],
    }).compile();
    app = module.createNestApplication<INestApplication<Server>>();
    app.setGlobalPrefix('api');
    app.useGlobalGuards(new JwtAuthGuard(new Reflector()), new PermissionsGuard(new Reflector()));
    app.useGlobalInterceptors(new ResponseInterceptor());
    await app.init();
  });
  afterAll(async () => {
    await app.close();
    jest.restoreAllMocks();
  });
  beforeEach(() => jest.clearAllMocks());
  const token = (role: string, permissions: string[]) =>
    jwt.sign({ idUser: 5, idSession: 1, roles: [role], permissions }, { secret, expiresIn: 60 });
  it.each(['STUDENT', 'ASSISTANT'])(
    'allows %s with seeded permissions and enforces owner/current filters',
    async (role) => {
      const permissions = rolesData.find((item) => item.name === role)!.permissions;
      expect(permissions).toContain('enrollment.get-my-enrollments');
      expect(permissions).toContain('enrollment.get-my-enrollment');
      expect(permissions).not.toContain('enrollment.get-all');
      const result = await request(app.getHttpServer())
        .get(
          '/api/enrollments/my-enrollments?current=true&idUser=99&userId=99&semesterId=99&isActive=false',
        )
        .auth(token(role, permissions), { type: 'bearer' })
        .expect(200);
      expect(result.body).toMatchObject({ data: [{ idEnrollment: 10 }] });
      expect(users.getOneById).toHaveBeenCalledWith(5);
      expect(repository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            user: { idUser: 5 },
            semester: { idSemester: 20 },
            isActive: true,
            role: In([CourseRelations.STUDENT, CourseRelations.ASSISTANT]),
          },
        }),
      );
    },
  );
  it('rejects STUDENT with only the singular permission before reading enrollments', async () => {
    await request(app.getHttpServer())
      .get('/api/enrollments/my-enrollments?current=true')
      .auth(token('STUDENT', ['enrollment.get-my-enrollment']), { type: 'bearer' })
      .expect(403);
    expect(repository.find).not.toHaveBeenCalled();
  });
  it('preserves SUPERADMIN bypass without explicit permissions', async () => {
    await request(app.getHttpServer())
      .get('/api/enrollments/my-enrollments?current=true')
      .auth(token('SUPERADMIN', []), { type: 'bearer' })
      .expect(200);
  });
  it('requires authentication', async () => {
    await request(app.getHttpServer()).get('/api/enrollments/my-enrollments').expect(401);
    expect(repository.find).not.toHaveBeenCalled();
  });
});
