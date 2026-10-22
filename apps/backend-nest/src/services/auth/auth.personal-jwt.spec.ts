import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { SessionsService } from '../sessions/sessions.service';
import { rolesData } from 'src/database/data/roles.data';
import type { JwtPayload } from '@common/types/jwt-payload.type';

describe.each(['STUDENT', 'ASSISTANT'])('%s access JWT permissions', (roleName) => {
  const permissionName = 'enrollment.get-my-enrollments';
  const jwt = new JwtService();
  beforeEach(() => {
    jest.replaceProperty(process, 'env', {
      ...process.env,
      JWT_ACCESS_SECRET: 'personal-access-test-only',
      JWT_ACCESS_REFRESH: 'personal-refresh-test-only',
      JWT_ACCESS_SECRET_EXPIRES_IN: '15m',
      JWT_ACCESS_REFRESH_EXPIRES_IN: '7d',
    });
  });
  afterEach(() => jest.restoreAllMocks());
  async function fixture(includeListing = true) {
    const definition = rolesData.find((role) => role.name === roleName)!;
    const user = {
      idUser: 5,
      username: 'persona',
      email: 'persona@example.test',
      name: 'Persona',
      roles: [
        {
          name: roleName,
          permissions: definition.permissions
            .filter((name) => includeListing || name !== permissionName)
            .map((name) => ({ name })),
        },
      ],
    };
    const users = {
      getForAuthentication: jest.fn(async () => ({
        ...user,
        password: await bcrypt.hash('test-password', 4),
      })),
      getOneById: jest.fn().mockImplementation(() => Promise.resolve(user)),
    };
    const session = { idSession: 7, user };
    const sessions = {
      createSession: jest.fn((params: Parameters<SessionsService['createSession']>[0]) =>
        Promise.resolve({ ...params.issueTokens(session.idSession), userSession: session }),
      ),
      validateRefreshToken: jest.fn().mockResolvedValue(session),
      updateLastSessionUsed: jest.fn().mockResolvedValue(undefined),
    };
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: JwtService, useValue: jwt },
        { provide: UsersService, useValue: users },
        { provide: SessionsService, useValue: sessions },
      ],
    }).compile();
    return { auth: module.get(AuthService), user, users };
  }
  const verify = (token: string) =>
    jwt.verify<JwtPayload>(token, { secret: process.env.JWT_ACCESS_SECRET });
  const login = (auth: AuthService) =>
    auth.login({ username: 'persona', password: 'test-password' }, {
      headers: {},
      socket: {},
    } as Request);
  it('signs a new login JWT with current personal listing permissions', async () => {
    const { auth } = await fixture();
    const result = await login(auth);
    const payload = verify(result.accessToken);
    expect(payload.roles).toEqual([roleName]);
    expect(payload.permissions).toContain(permissionName);
    expect(payload.permissions).toContain('enrollment.get-my-enrollment');
    expect(payload.permissions).not.toContain('enrollment.get-all');
  });
  it('refreshes old permissions from the database instead of trusting the previous JWT', async () => {
    const { auth, user, users } = await fixture(false);
    const old = await login(auth);
    expect(verify(old.accessToken).permissions).not.toContain(permissionName);
    user.roles[0].permissions.push({ name: permissionName });
    expect((await auth.getSession(5, 7)).permissions).toContain(permissionName);
    expect(verify(old.accessToken).permissions).not.toContain(permissionName);
    const refreshed = await auth.refreshToken(old.refreshToken);
    expect(users.getOneById).toHaveBeenCalledWith(5);
    expect(verify(refreshed.accessToken).permissions).toContain(permissionName);
    expect(verify(refreshed.accessToken).roles).toEqual([roleName]);
  });
});
