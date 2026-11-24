import { UnauthorizedException, type INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import request from 'supertest';
import { AppController } from '../src/app.controller';
import { AppService } from '../src/app.service';
import { JwtAuthGuard } from '../src/core/guards/auth/auth.guard';
import { PermissionsGuard } from '../src/core/guards/permissions/permissions.guard';
import { JwtStrategy } from '../src/core/strategies/jwt/jwt.strategy';
import { SessionsService } from '../src/services/sessions/sessions.service';

// Exercise the real HTTP controller, JWT strategy and global guards without booting
// AppModule's application database or queues. Database integration has isolated suites.
describe('AppController HTTP authentication (isolated)', () => {
  let app: INestApplication<Server>;
  const secret = 'app-http-test-only-secret';
  const assertActiveSession = jest.fn<Promise<void>, [number, number]>(() => Promise.resolve());
  const token = () =>
    new JwtService().sign(
      {
        idUser: 1,
        idSession: 7,
        username: 'fixture',
        email: '',
        roles: ['STUDENT'],
        permissions: [],
      },
      { secret, expiresIn: 60 },
    );

  beforeAll(async () => {
    jest.replaceProperty(process, 'env', { ...process.env, JWT_ACCESS_SECRET: secret });
    const moduleFixture = await Test.createTestingModule({
      imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
      controllers: [AppController],
      providers: [
        AppService,
        JwtStrategy,
        { provide: SessionsService, useValue: { assertActiveSession } },
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: PermissionsGuard },
      ],
    }).compile();
    app = moduleFixture.createNestApplication<INestApplication<Server>>();
    app.setGlobalPrefix('api');
    await app.init();
  });

  beforeEach(() => jest.clearAllMocks());
  afterAll(async () => {
    await app?.close();
    jest.restoreAllMocks();
  });

  it('rejects requests without an access token', async () => {
    await request(app.getHttpServer()).get('/api').expect(401);
    expect(assertActiveSession).not.toHaveBeenCalled();
  });

  it('serves the root controller only after validating the signed session', async () => {
    await request(app.getHttpServer())
      .get('/api')
      .auth(token(), { type: 'bearer' })
      .expect(200)
      .expect('Hello World!');
    expect(assertActiveSession).toHaveBeenCalledWith(7, 1);
  });

  it('rejects a revoked session without serving the controller', async () => {
    assertActiveSession.mockRejectedValueOnce(new UnauthorizedException('Test session revoked'));
    await request(app.getHttpServer()).get('/api').auth(token(), { type: 'bearer' }).expect(401);
    expect(assertActiveSession).toHaveBeenCalledWith(7, 1);
  });

  it('rejects an invalid token before consulting session authority', async () => {
    await request(app.getHttpServer())
      .get('/api')
      .auth('invalid-test-token', { type: 'bearer' })
      .expect(401);
    expect(assertActiveSession).not.toHaveBeenCalled();
  });
});
