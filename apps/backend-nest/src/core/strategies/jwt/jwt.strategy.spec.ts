import { UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SessionsService } from 'src/services/sessions/sessions.service';
import { UserSession } from 'src/entities/user-sessions/user-sessions.entity';
import type { JwtPayload } from '@common/types/jwt-payload.type';
import { JwtStrategy } from './jwt.strategy';

describe('JWT session authority', () => {
  let strategy: JwtStrategy;
  let stored: { idSession: number; idUser: number; isActive: boolean; expiresAt: Date } | null;
  let filter: { idSession: number; idUser: number; now: Date };
  const where = jest.fn<unknown, [string, typeof filter]>();
  const getExists = jest.fn(() =>
    Promise.resolve(
      !!stored &&
        stored.idSession === filter.idSession &&
        stored.idUser === filter.idUser &&
        stored.isActive &&
        stored.expiresAt > filter.now,
    ),
  );
  const query = { where, getExists };
  const repository = { createQueryBuilder: jest.fn(() => query) };
  const payload: JwtPayload = {
    idUser: 1,
    idSession: 7,
    username: 'user',
    email: '',
    roles: ['STUDENT'],
    permissions: ['enrollment.get-my-enrollments'],
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.replaceProperty(process, 'env', {
      ...process.env,
      JWT_ACCESS_SECRET: 'strategy-test-only',
    });
    stored = { idSession: 7, idUser: 1, isActive: true, expiresAt: new Date(Date.now() + 60000) };
    where.mockImplementation((_sql: string, parameters: typeof filter) => {
      filter = parameters;
      return query;
    });
    const module = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        SessionsService,
        { provide: getRepositoryToken(UserSession), useValue: repository },
      ],
    }).compile();
    strategy = module.get(JwtStrategy);
  });
  afterEach(() => jest.restoreAllMocks());

  it('allows a live owned session with a minimal existence query and preserves JWT permissions', async () => {
    expect(await strategy.validate(payload)).toBe(payload);
    expect(filter).toMatchObject({ idSession: 7, idUser: 1 });
    expect(getExists).toHaveBeenCalledTimes(1);
    const sql = where.mock.calls[0][0];
    expect(sql).toContain('session.id_user = :idUser');
    expect(sql).toContain('session.expires_at > :now');
    expect(sql.toLowerCase()).not.toContain('join');
  });

  it.each(['missing', 'inactive', 'expired', 'wrong-user'])(
    'rejects %s sessions with 401',
    async (state) => {
      if (state === 'missing') stored = null;
      if (state === 'inactive') stored!.isActive = false;
      if (state === 'expired') stored!.expiresAt = new Date(0);
      if (state === 'wrong-user') stored!.idUser = 2;
      await expect(strategy.validate(payload)).rejects.toBeInstanceOf(UnauthorizedException);
    },
  );

  it.each([undefined, null, 0, -1, '7', 1.5])(
    'rejects an invalid/legacy session id %s before querying',
    async (idSession) => {
      await expect(
        strategy.validate({ ...payload, idSession } as unknown as JwtPayload),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(repository.createQueryBuilder).not.toHaveBeenCalled();
    },
  );
});
