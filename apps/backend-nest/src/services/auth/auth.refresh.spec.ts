import { INestApplication, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import type { Server } from 'node:http';
import { AuthController } from 'src/controllers/auth/auth.controller';
import { SessionsController } from 'src/controllers/sessions/sessions.controller';
import { UserSession } from 'src/entities/user-sessions/user-sessions.entity';
import { User } from 'src/entities/users/users.entity';
import { JwtStrategy } from '@core/strategies/jwt/jwt.strategy';
import { JwtAuthGuard } from '@core/guards/auth/auth.guard';
import { PermissionsGuard } from '@core/guards/permissions/permissions.guard';
import { SessionRevokeReasons } from '@common/enums/sessionRevokeReasons';
import { ResponseInterceptor } from '@core/interceptors/response/response.interceptor';
import { HttpExceptionFilter } from '@core/filters/http-exception/http-exception.filter';
import { SessionsService } from '../sessions/sessions.service';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';

describe('Refresh authentication flow', () => {
  let app: INestApplication<Server>;
  let auth: AuthService;
  let sessions: SessionsService;
  let jwt: JwtService;
  let token: string;
  let session: UserSession;
  let otherSessions: UserSession[];
  const user = Object.assign(new User(), {
    idUser: 1,
    username: 'test',
    roles: [{ name: 'SUPERADMIN', permissions: [{ name: 'session.get-all' }] }],
  });
  const repository = {
    createQueryBuilder: jest.fn(() => {
      let query = { idSession: 0, idUser: 0, now: new Date() };
      return {
        where(this: { getExists: () => Promise<boolean> }, _sql: string, parameters: typeof query) {
          query = parameters;
          return this;
        },
        getExists() {
          return Promise.resolve(
            [session, ...otherSessions].some(
              (value) =>
                value.idSession === query.idSession &&
                value.user.idUser === query.idUser &&
                value.isActive &&
                value.expiresAt > query.now,
            ),
          );
        },
      };
    }),
    find: jest.fn<Promise<UserSession[]>, [unknown]>(),
    findOne: jest.fn<Promise<UserSession | null>, [unknown]>(),
    save: jest.fn((value: UserSession) => Promise.resolve(value)),
    update: jest.fn<Promise<{ affected: number }>, [unknown, unknown]>(() =>
      Promise.resolve({ affected: 1 }),
    ),
    delete: jest.fn(),
    remove: jest.fn(),
  };
  const users = { getOneById: jest.fn(() => Promise.resolve(user)) };

  beforeEach(async () => {
    jest.clearAllMocks();
    repository.find.mockReset();
    repository.findOne.mockReset();
    repository.update.mockReset().mockResolvedValue({ affected: 1 });
    jest.replaceProperty(process, 'env', {
      ...process.env,
      JWT_ACCESS_SECRET: 'refresh-access-test-only',
      JWT_ACCESS_REFRESH: 'refresh-test-only',
      JWT_ACCESS_SECRET_EXPIRES_IN: '15m',
      JWT_ACCESS_REFRESH_EXPIRES_IN: '7d',
    });
    jwt = new JwtService();
    token = jwt.sign(
      { jti: 'legacy-compatible', idUser: 1 },
      {
        secret: process.env.JWT_ACCESS_REFRESH,
        expiresIn: 3600,
      },
    );
    session = Object.assign(new UserSession(), {
      idSession: 7,
      user,
      isActive: true,
      expiresAt: new Date(Date.now() + 3600000),
      refreshToken: await bcrypt.hash(token, 4),
    });
    repository.find.mockResolvedValue([session]);
    otherSessions = [
      Object.assign(new UserSession(), {
        idSession: 100,
        user: Object.assign(new User(), { idUser: 99 }),
        isActive: true,
        expiresAt: new Date(Date.now() + 3600000),
      }),
    ];
    repository.findOne.mockImplementation((options: unknown) => {
      const { where } = options as { where: { idSession: number } };
      return Promise.resolve(
        [session, ...otherSessions].find((value) => value.idSession === where.idSession) ?? null,
      );
    });
    const module = await Test.createTestingModule({
      imports: [PassportModule],
      controllers: [AuthController, SessionsController],
      providers: [
        AuthService,
        SessionsService,
        JwtStrategy,
        JwtAuthGuard,
        PermissionsGuard,
        { provide: JwtService, useValue: jwt },
        { provide: UsersService, useValue: users },
        { provide: getRepositoryToken(UserSession), useValue: repository },
      ],
    }).compile();
    auth = module.get(AuthService);
    sessions = module.get(SessionsService);
    app = module.createNestApplication<INestApplication<Server>>();
    app.setGlobalPrefix('api');
    app.useGlobalGuards(module.get(JwtAuthGuard), module.get(PermissionsGuard));
    app.useGlobalInterceptors(new ResponseInterceptor());
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  afterEach(async () => {
    await app?.close();
    jest.restoreAllMocks();
  });

  it('rejects expired access, refreshes through the real HTTP envelope and accepts the new access', async () => {
    const oldAccess = jwt.sign(
      { idUser: 1, idSession: 7 },
      {
        secret: process.env.JWT_ACCESS_SECRET,
        expiresIn: -1,
      },
    );
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${oldAccess}`)
      .expect(401);
    const response = await request(app.getHttpServer())
      .post('/api/auth/refresh-access-token')
      .send({ refreshToken: token })
      .expect(201);
    const body = response.body as { data: { accessToken: string } };
    const newAccess = body.data.accessToken;
    expect(newAccess).not.toBe(oldAccess);
    const payload = jwt.verify<{
      exp: number;
      iat: number;
      roles: string[];
      permissions: string[];
    }>(newAccess, { secret: process.env.JWT_ACCESS_SECRET });
    expect(payload.exp - payload.iat).toBe(900);
    expect(payload.roles).toEqual(['SUPERADMIN']);
    expect(payload.permissions).toEqual(['session.get-all']);
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${newAccess}`)
      .expect(200);
    expect(repository.save).not.toHaveBeenCalled();
    expect(repository.update).toHaveBeenCalledTimes(1);
    expect(repository.find.mock.calls[0][0]).toMatchObject({
      where: { user: { idUser: 1 }, isActive: true },
    });
  });

  it.each([
    'invalid',
    'expired',
    'missing',
    'inactive',
    'session-expired',
    'wrong-user',
    'wrong-hash',
    'bad-payload',
  ])('returns HTTP 401 rather than 500 for %s refresh', async (scenario) => {
    let supplied = token;
    if (scenario === 'invalid') supplied = 'invalid-token';
    if (scenario === 'expired')
      supplied = jwt.sign(
        { idUser: 1 },
        {
          secret: process.env.JWT_ACCESS_REFRESH,
          expiresIn: -1,
        },
      );
    if (scenario === 'missing') repository.find.mockResolvedValue([]);
    if (scenario === 'inactive') session.isActive = false;
    if (scenario === 'session-expired') session.expiresAt = new Date(0);
    if (scenario === 'wrong-user') session.user = Object.assign(new User(), { idUser: 2 });
    if (scenario === 'wrong-hash') session.refreshToken = await bcrypt.hash('other', 4);
    if (scenario === 'bad-payload')
      supplied = jwt.sign(
        { idUser: '1' },
        {
          secret: process.env.JWT_ACCESS_REFRESH,
          expiresIn: 3600,
        },
      );
    await request(app.getHttpServer())
      .post('/api/auth/refresh-access-token')
      .send({ refreshToken: supplied })
      .expect(401);
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('preserves internal database errors as HTTP 500', async () => {
    repository.find.mockRejectedValueOnce(new Error('database unavailable'));
    await request(app.getHttpServer())
      .post('/api/auth/refresh-access-token')
      .send({ refreshToken: token })
      .expect(500);
  });

  it('does not persist activity if signing fails', async () => {
    jest.spyOn(jwt, 'sign').mockImplementationOnce(() => {
      throw new Error('sign failed');
    });
    await expect(auth.refreshToken(token)).rejects.toThrow('sign failed');
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('accepts previously issued refresh tokens without a session id or jti', async () => {
    const legacy = jwt.sign(
      { idUser: 1 },
      {
        secret: process.env.JWT_ACCESS_REFRESH,
        expiresIn: 3600,
      },
    );
    session.refreshToken = await bcrypt.hash(legacy, 4);
    await expect(auth.refreshToken(legacy)).resolves.toHaveProperty('accessToken');
  });

  it('does not report missing server configuration as invalid credentials', async () => {
    delete process.env.JWT_ACCESS_REFRESH;
    await expect(auth.refreshToken(token)).rejects.toThrow('JWT_ACCESS_REFRESH is required');
    expect(repository.find).not.toHaveBeenCalled();
  });

  it('keeps logout revocation effective for subsequent refresh', async () => {
    await sessions.logout(token);
    expect(session.isActive).toBe(false);
    await expect(auth.refreshToken(token)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('recovers a legacy access without idSession through its still-valid legacy refresh', async () => {
    const oldAccess = jwt.sign(
      { idUser: 1, roles: [], permissions: [] },
      {
        secret: process.env.JWT_ACCESS_SECRET,
        expiresIn: 900,
      },
    );
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .auth(oldAccess, { type: 'bearer' })
      .expect(401);
    const response = await request(app.getHttpServer())
      .post('/api/auth/refresh-access-token')
      .send({ refreshToken: token })
      .expect(201);
    const body = response.body as { data: { accessToken: string } };
    expect(
      jwt.verify<{ idSession: number }>(body.data.accessToken, {
        secret: process.env.JWT_ACCESS_SECRET,
      }).idSession,
    ).toBe(7);
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .auth(body.data.accessToken, { type: 'bearer' })
      .expect(200);
  });

  it('normal HTTP logout revokes the current session and its existing access immediately', async () => {
    const access = jwt.sign(
      { idUser: 1, idSession: 7, roles: [], permissions: [] },
      {
        secret: process.env.JWT_ACCESS_SECRET,
        expiresIn: 900,
      },
    );
    await request(app.getHttpServer())
      .post('/api/sessions/logout')
      .auth(access, { type: 'bearer' })
      .send({ refreshToken: token })
      .expect(201);
    expect(session.isActive).toBe(false);
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .auth(access, { type: 'bearer' })
      .expect(401);
  });

  it('rejects a refresh that loses the race to remote revocation without saving a stale active entity', async () => {
    repository.update.mockResolvedValueOnce({ affected: 0 });
    await expect(auth.refreshToken(token)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(repository.save).not.toHaveBeenCalled();
    expect(repository.update.mock.calls[0]).toHaveLength(2);
    expect(repository.update.mock.calls[0][0]).toMatchObject({ idSession: 7, isActive: true });
    const fields = repository.update.mock.calls[0][1] as Record<string, unknown>;
    expect(Object.keys(fields)).toEqual(['lastUsedAt']);
    expect(fields.lastUsedAt).toBeInstanceOf(Date);
  });

  it.each([
    { roles: ['SUPERADMIN'], permissions: [] },
    { roles: ['ADMIN'], permissions: ['sessions.revoke-one'] },
  ])(
    'allows remote revocation with %j and rejects the exact same access immediately',
    async (claims) => {
      const actorAccess = jwt.sign(
        { idUser: 99, idSession: 100, ...claims },
        {
          secret: process.env.JWT_ACCESS_SECRET,
          expiresIn: 900,
        },
      );
      const targetAccess = jwt.sign(
        { idUser: 1, idSession: 7, roles: [], permissions: [] },
        {
          secret: process.env.JWT_ACCESS_SECRET,
          expiresIn: 900,
        },
      );
      await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${targetAccess}`)
        .expect(200);
      await request(app.getHttpServer())
        .patch('/api/sessions/revoke/7')
        .set('Authorization', `Bearer ${actorAccess}`)
        .expect(200);
      expect(session.isActive).toBe(false);
      expect(session.revokedAt).toBeInstanceOf(Date);
      expect(session.revokedReason).toBe(SessionRevokeReasons.ADMIN_ACTION);
      expect(session.revokedBy?.idUser).toBe(99);
      expect(repository.save).toHaveBeenCalledTimes(1);
      const revokedAt = session.revokedAt;
      await request(app.getHttpServer())
        .patch('/api/sessions/revoke/7')
        .set('Authorization', `Bearer ${actorAccess}`)
        .expect(200);
      expect(session.revokedAt).toBe(revokedAt);
      expect(repository.save).toHaveBeenCalledTimes(1);
      expect(repository.delete).not.toHaveBeenCalled();
      expect(repository.remove).not.toHaveBeenCalled();
      await request(app.getHttpServer())
        .post('/api/auth/refresh-access-token')
        .send({ refreshToken: token })
        .expect(401);
      await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${targetAccess}`)
        .expect(401);
    },
  );

  it('returns 403 without the real revocation permission', async () => {
    const access = jwt.sign(
      { idUser: 99, idSession: 100, roles: ['ADMIN'], permissions: ['session.revoke-one'] },
      {
        secret: process.env.JWT_ACCESS_SECRET,
        expiresIn: 900,
      },
    );
    await request(app.getHttpServer())
      .patch('/api/sessions/revoke/7')
      .set('Authorization', `Bearer ${access}`)
      .expect(403);
    expect(repository.findOne).not.toHaveBeenCalled();
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('uses a single session lookup for new refresh tokens and keeps legacy fallback separate', async () => {
    const linked = jwt.sign(
      { jti: 'linked', idUser: 1, idSession: 7 },
      {
        secret: process.env.JWT_ACCESS_REFRESH,
        expiresIn: 3600,
      },
    );
    session.refreshToken = await bcrypt.hash(linked, 4);
    await expect(auth.refreshToken(linked)).resolves.toHaveProperty('accessToken');
    expect(repository.findOne).toHaveBeenCalledTimes(1);
    expect(repository.find).not.toHaveBeenCalled();
  });

  it('does not fall back to another session when a refresh has an invalid session id', async () => {
    const linked = jwt.sign(
      { idUser: 1, idSession: 8 },
      {
        secret: process.env.JWT_ACCESS_REFRESH,
        expiresIn: 3600,
      },
    );
    session.refreshToken = await bcrypt.hash(linked, 4);
    await expect(auth.refreshToken(linked)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(repository.find).not.toHaveBeenCalled();
  });

  it('revokes only A while access and refresh for session B of the same user remain valid', async () => {
    const refreshB = jwt.sign(
      { jti: 'session-b', idUser: 1, idSession: 8 },
      {
        secret: process.env.JWT_ACCESS_REFRESH,
        expiresIn: 3600,
      },
    );
    const b = Object.assign(new UserSession(), {
      idSession: 8,
      user,
      isActive: true,
      expiresAt: new Date(Date.now() + 3600000),
      refreshToken: await bcrypt.hash(refreshB, 4),
    });
    otherSessions.push(b);
    const access = (idSession: number) =>
      jwt.sign(
        { idUser: 1, idSession, roles: [], permissions: [] },
        {
          secret: process.env.JWT_ACCESS_SECRET,
          expiresIn: 900,
        },
      );
    const accessA = access(7);
    const accessB = access(8);
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .auth(accessA, { type: 'bearer' })
      .expect(200);
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .auth(accessB, { type: 'bearer' })
      .expect(200);
    await request(app.getHttpServer())
      .post('/api/sessions/logout')
      .auth(accessA, { type: 'bearer' })
      .send({ refreshToken: refreshB })
      .expect(401);
    expect(session.isActive).toBe(true);
    expect(b.isActive).toBe(true);
    await sessions.revokeSessionById(7, { idUser: 99 });
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .auth(accessA, { type: 'bearer' })
      .expect(401);
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .auth(accessB, { type: 'bearer' })
      .expect(200);
    await expect(auth.refreshToken(token)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(auth.refreshToken(refreshB)).resolves.toHaveProperty('accessToken');
    expect(b.isActive).toBe(true);
  });

  it('keeps logout-all effective for every session of the current user', async () => {
    const b = Object.assign(new UserSession(), { ...session, idSession: 8 });
    otherSessions.push(b);
    repository.find.mockResolvedValueOnce([session, b]);
    const access = (idSession: number) =>
      jwt.sign(
        { idUser: 1, idSession, roles: ['SUPERADMIN'], permissions: [] },
        {
          secret: process.env.JWT_ACCESS_SECRET,
          expiresIn: 900,
        },
      );
    const a = access(7);
    const second = access(8);
    await request(app.getHttpServer())
      .patch('/api/sessions/revoke-all')
      .auth(a, { type: 'bearer' })
      .expect(200);
    expect(session.isActive).toBe(false);
    expect(b.isActive).toBe(false);
    await request(app.getHttpServer()).get('/api/auth/me').auth(a, { type: 'bearer' }).expect(401);
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .auth(second, { type: 'bearer' })
      .expect(401);
  });

  it('returns 404 for a missing session', async () => {
    repository.findOne.mockResolvedValue(null);
    const access = jwt.sign(
      { idUser: 99, idSession: 100, roles: ['SUPERADMIN'], permissions: [] },
      {
        secret: process.env.JWT_ACCESS_SECRET,
        expiresIn: 900,
      },
    );
    await request(app.getHttpServer())
      .patch('/api/sessions/revoke/999')
      .set('Authorization', `Bearer ${access}`)
      .expect(404);
    expect(repository.save).not.toHaveBeenCalled();
  });
});
