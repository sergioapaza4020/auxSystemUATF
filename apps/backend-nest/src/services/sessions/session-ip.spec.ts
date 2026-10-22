import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { instanceToPlain } from 'class-transformer';
import type { Request } from 'express';
import { UserSession } from 'src/entities/user-sessions/user-sessions.entity';
import { User } from 'src/entities/users/users.entity';
import { AuthService } from '../auth/auth.service';
import { UsersService } from '../users/users.service';
import { SessionsService } from './sessions.service';
import { withSessionTransaction } from '@common/test-mocks/session-transaction.mock';

describe('Session IP boundaries', () => {
  beforeEach(() => {
    jest.replaceProperty(process, 'env', {
      ...process.env,
      JWT_ACCESS_SECRET_EXPIRES_IN: '15m',
      JWT_ACCESS_REFRESH_EXPIRES_IN: '7d',
    });
  });
  afterEach(() => jest.restoreAllMocks());
  it.each([
    ['::ffff:10.0.0.5', '10.0.0.5'],
    ['::1', '127.0.0.1'],
    ['2001:db8::1', '2001:db8::1'],
  ])('persists and returns request.ip %s as %s during login', async (ip, expected) => {
    const repository = {
      create: jest.fn((params: Partial<UserSession>) => Object.assign(new UserSession(), params)),
      save: jest.fn((session: UserSession) =>
        Promise.resolve(Object.assign(session, { idSession: 1 })),
      ),
    };
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        SessionsService,
        { provide: UsersService, useValue: {} },
        { provide: JwtService, useValue: { sign: () => 'test-token' } },
        { provide: getRepositoryToken(UserSession), useValue: withSessionTransaction(repository) },
      ],
    }).compile();
    const auth = module.get(AuthService);
    jest
      .spyOn(auth, 'validateUser')
      .mockResolvedValue(Object.assign(new User(), { idUser: 1, roles: [] }));

    const response = await auth.login({ username: 'test', password: 'secret' }, {
      ip,
      headers: { 'x-forwarded-for': '203.0.113.10, 10.0.0.1' },
      socket: { remoteAddress: '::1' },
    } as unknown as Request);

    expect(repository.save).toHaveBeenCalledWith(expect.objectContaining({ ipAddress: expected }));
    expect(response.userSession.ipAddress).toBe(expected);
  });

  it.each([
    ['::ffff:192.168.1.25', '192.168.1.25'],
    ['::1', '127.0.0.1'],
    ['2001:db8::1234', '2001:db8::1234'],
    [null, null],
  ])('serializes historical IP %s without mutating it', (ipAddress, expected) => {
    const historical = Object.assign(new UserSession(), { ipAddress });
    const response = instanceToPlain({ data: [historical] });

    expect(response).toEqual({ data: [expect.objectContaining({ ipAddress: expected })] });
    expect(historical.ipAddress).toBe(ipAddress);
  });
});
