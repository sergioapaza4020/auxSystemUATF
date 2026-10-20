import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { SessionsService } from '../sessions/sessions.service';
import { UserSession } from 'src/entities/user-sessions/user-sessions.entity';
import { User } from 'src/entities/users/users.entity';

describe('Concurrent logins with multiple sessions', () => {
  it('creates independent tokens and resolves each refresh token to its own session', async () => {
    const environment = jest.replaceProperty(process, 'env', {
      ...process.env,
      JWT_ACCESS_REFRESH: 'concurrency-test-secret',
      JWT_ACCESS_REFRESH_EXPIRES_IN: '7d',
      JWT_ACCESS_SECRET: 'concurrency-test-secret',
      JWT_ACCESS_SECRET_EXPIRES_IN: '15m',
    });
    const jwtService = new JwtService({ secret: 'concurrency-test-secret' });
    // Fix issuance time without freezing bcrypt or other asynchronous work.
    const now = jest.spyOn(Date, 'now').mockReturnValue(1_800_000_000_000);
    const stored: UserSession[] = [];
    const repository = {
      create: jest.fn((params: Partial<UserSession>) => Object.assign(new UserSession(), params)),
      save: jest.fn((session: UserSession) => {
        if (!session.idSession) {
          session.idSession = stored.length + 1;
          session.isActive = true;
          stored.push(session);
        }
        return Promise.resolve(session);
      }),
      find: jest.fn(() => Promise.resolve(stored.filter((session) => session.isActive))),
    };
    const hash = await bcrypt.hash('secret', 4);
    const users = {
      // Each repository query returns a separate entity, as TypeORM does.
      getForAuthentication: jest.fn(() =>
        Promise.resolve(
          Object.assign(new User(), {
            idUser: 1,
            username: 'test',
            password: hash,
            roles: [],
          }),
        ),
      ),
    };

    try {
      const module = await Test.createTestingModule({
        providers: [
          AuthService,
          SessionsService,
          { provide: JwtService, useValue: jwtService },
          { provide: UsersService, useValue: users },
          { provide: getRepositoryToken(UserSession), useValue: repository },
        ],
      }).compile();
      const auth = module.get(AuthService);
      const sessions = module.get(SessionsService);
      const request = { headers: {}, socket: {} } as Request;
      const credentials = { username: 'test', password: 'secret' };
      const [first, second] = await Promise.all([
        auth.login(credentials, request),
        auth.login(credentials, request),
      ]);

      expect(first.refreshToken).not.toBe(second.refreshToken);
      expect(first.refreshToken.slice(0, 72)).not.toBe(second.refreshToken.slice(0, 72));
      expect(stored).toHaveLength(2);
      expect(first.userSession.idSession).not.toBe(second.userSession.idSession);
      for (const result of [first, second]) {
        const refreshPayload = jwtService.verify<{ idUser: number; jti: string }>(
          result.refreshToken,
        );
        expect(refreshPayload.idUser).toBe(1);
        expect(refreshPayload.jti).toMatch(/^[0-9a-f-]{36}$/);
        expect(jwtService.verify<{ idSession: number }>(result.accessToken).idSession).toBe(
          result.userSession.idSession,
        );
        expect((await sessions.validateRefreshToken(result.refreshToken)).idSession).toBe(
          result.userSession.idSession,
        );
      }

      await sessions.revokeSession(first.userSession);
      await expect(sessions.validateRefreshToken(first.refreshToken)).rejects.toThrow(
        'Invalid token refresh',
      );
      expect((await sessions.validateRefreshToken(second.refreshToken)).idSession).toBe(
        second.userSession.idSession,
      );
      expect(users.getForAuthentication).toHaveBeenCalledTimes(2);
    } finally {
      now.mockRestore();
      environment.restore();
    }
  });
});
