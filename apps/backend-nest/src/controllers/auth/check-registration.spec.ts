import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { DataSource, FindOneOptions } from 'typeorm';
import type { Server } from 'node:http';
import request from 'supertest';
import { AuthController } from './auth.controller';
import { AuthService } from 'src/services/auth/auth.service';
import { UsersService } from 'src/services/users/users.service';
import { SessionsService } from 'src/services/sessions/sessions.service';
import { RolesService } from 'src/services/roles/roles.service';
import { BulkOperationsService } from 'src/services/bulk-operations/bulk-operations.service';
import { User } from 'src/entities/users/users.entity';
import { JwtAuthGuard } from '@core/guards/auth/auth.guard';
import { PermissionsGuard } from '@core/guards/permissions/permissions.guard';
import { createValidationPipe } from '@core/pipes/validation.pipe';
import { ResponseInterceptor } from '@core/interceptors/response/response.interceptor';
import { HttpExceptionFilter } from '@core/filters/http-exception/http-exception.filter';

class MetadataSource extends DataSource {
  async prepare() {
    await this.buildMetadatas();
  }
}

describe('Public registration check: controller, auth and users services', () => {
  const source = new MetadataSource({
    type: 'postgres',
    entities: [__dirname + '/../../entities/**/*.entity.ts'],
  });
  let app: INestApplication<Server>;
  let auth: AuthService;
  let users: UsersService;
  let find: jest.SpyInstance<Promise<User | null>, [FindOneOptions<User>]>;

  beforeAll(async () => {
    await source.prepare();
    const repository = source.getRepository(User);
    find = jest.spyOn(repository, 'findOne');
    users = new UsersService(repository, {} as RolesService, {} as BulkOperationsService);
    auth = new AuthService({} as JwtService, users, {} as SessionsService);
    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: auth }],
    }).compile();
    app = module.createNestApplication<INestApplication<Server>>();
    app.setGlobalPrefix('api');
    app.useGlobalGuards(new JwtAuthGuard(new Reflector()), new PermissionsGuard(new Reflector()));
    app.useGlobalPipes(createValidationPipe());
    app.useGlobalInterceptors(new ResponseInterceptor());
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  beforeEach(() => find.mockReset());
  afterAll(async () => {
    await app?.close();
    jest.restoreAllMocks();
  });

  it.each([
    [true, 'ACTIVE'],
    [false, 'INACTIVE'],
    [null, 'NOT_FOUND'],
  ] as const)(
    'returns only registration status for isActive=%s without a token',
    async (active, status) => {
      find.mockResolvedValue(
        active === null
          ? null
          : Object.assign(new User(), {
              isActive: active,
              idUser: 1,
              email: 'private@example.com',
              ci: 'private',
              name: 'private',
              roles: [],
              permissions: [],
            }),
      );
      const response = await request(app.getHttpServer())
        .post('/api/auth/check-registration')
        .send({ ru: '  00aB123  ' })
        .expect(200);
      expect(response.body).toEqual({
        status: true,
        statusCode: 200,
        message: 'Registration checked successfully',
        data: { registered: active !== null, status },
      });
      expect(find).toHaveBeenCalledWith({
        where: { ru: '00aB123' },
        select: { isActive: true },
        loadEagerRelations: false,
      });
    },
  );

  it.each([{}, { ru: '' }, { ru: '   ' }, { ru: null }, { ru: 123 }, { ru: [] }, { ru: {} }])(
    'validates invalid body %j before querying',
    async (body) => {
      await request(app.getHttpServer())
        .post('/api/auth/check-registration')
        .send(body)
        .expect(400);
      expect(find).not.toHaveBeenCalled();
    },
  );

  it('ignores idUser and additional fields and queries only by RU', async () => {
    find.mockResolvedValue(null);
    await request(app.getHttpServer())
      .post('/api/auth/check-registration')
      .send({ ru: '123', idUser: 99 })
      .expect(200);
    expect(find.mock.calls[0][0].where).toEqual({ ru: '123' });
  });

  it('generates a parameterized minimal query that excludes soft deletes without filtering inactive accounts', async () => {
    find.mockResolvedValue(null);
    await users.getRegistrationByRu(' 00123 ');
    const query = source
      .getRepository(User)
      .createQueryBuilder('user')
      .setFindOptions(find.mock.calls[0][0]);
    const sql = query.getSql();
    expect(sql).toContain('"user"."deleted_at" IS NULL');
    expect(sql).not.toContain('JOIN');
    expect(sql.split(' FROM ')[0]).toBe('SELECT "user"."is_active" AS "user_is_active"');
    expect(query.getParameters()).toEqual(expect.objectContaining({ orm_param_0: '00123' }));
  });

  it('propagates database failures instead of reporting NOT_FOUND', async () => {
    find.mockRejectedValue(new Error('database unavailable'));
    await expect(auth.checkRegistration({ ru: '123' })).rejects.toThrow('database unavailable');
  });
});
