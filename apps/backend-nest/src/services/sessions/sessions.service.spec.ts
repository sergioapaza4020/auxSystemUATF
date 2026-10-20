import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UserSession } from 'src/entities/user-sessions/user-sessions.entity';
import { SessionQueryDto } from 'src/dtos/sessions/session-query.dto';
import { SessionsService } from './sessions.service';

type SessionFixture = Pick<UserSession, 'idSession' | 'isActive' | 'lastUsedAt'>;
interface SessionQueryMock {
  leftJoinAndSelect: jest.Mock<SessionQueryMock, [string, string]>;
  orderBy: jest.Mock<SessionQueryMock, [string, string]>;
  addOrderBy: jest.Mock<SessionQueryMock, [string, string, string?]>;
  skip: jest.Mock<SessionQueryMock, [number]>;
  take: jest.Mock<SessionQueryMock, [number]>;
  getManyAndCount: jest.Mock<Promise<[SessionFixture[], number]>, []>;
  getMany: jest.Mock;
}

describe('Sessions SQL pagination', () => {
  const sessions = Array.from({ length: 5 }, (_, index) => ({
    idSession: 5 - index,
    isActive: true,
    lastUsedAt: new Date('2026-10-13'),
  }));
  let service: SessionsService;
  let offset: number;
  let limit: number;
  const qb: SessionQueryMock = {
    leftJoinAndSelect: jest.fn<SessionQueryMock, [string, string]>().mockReturnThis(),
    orderBy: jest.fn<SessionQueryMock, [string, string]>().mockReturnThis(),
    addOrderBy: jest.fn<SessionQueryMock, [string, string, string?]>().mockReturnThis(),
    skip: jest.fn((value: number) => {
      offset = value;
      return qb;
    }),
    take: jest.fn((value: number) => {
      limit = value;
      return qb;
    }),
    getManyAndCount: jest.fn(() =>
      Promise.resolve([sessions.slice(offset, offset + limit), sessions.length]),
    ),
    getMany: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    offset = 0;
    limit = 0;
    const module = await Test.createTestingModule({
      providers: [
        SessionsService,
        {
          provide: getRepositoryToken(UserSession),
          useValue: { createQueryBuilder: () => qb },
        },
      ],
    }).compile();

    service = module.get(SessionsService);
  });

  it('returns limited page 1/page 2, global total and totalPages', async () => {
    const first = await service.getAllSessions({ page: 1, limit: 2 });
    const second = await service.getAllSessions({ page: 2, limit: 2 });

    expect(first.data).toHaveLength(2);
    expect(second.data).toHaveLength(2);
    expect(
      first.data.some((row) => second.data.some((other) => other.idSession === row.idSession)),
    ).toBe(false);
    expect(second.meta).toEqual({ page: 2, limit: 2, total: 5, totalPages: 3 });
    expect(qb.skip).toHaveBeenLastCalledWith(2);
    expect(qb.take).toHaveBeenLastCalledWith(2);
    expect(qb.getMany).not.toHaveBeenCalled();
  });

  it('preserves active/activity order and adds a unique SQL tiebreaker before pagination', async () => {
    await service.getAllSessions({});

    expect(qb.orderBy).toHaveBeenCalledWith('session.isActive', 'DESC');
    expect(qb.addOrderBy.mock.calls).toEqual([
      ['session.lastUsedAt', 'DESC', 'NULLS LAST'],
      ['session.idSession', 'DESC'],
    ]);
    expect(qb.addOrderBy.mock.invocationCallOrder[1]).toBeLessThan(
      qb.skip.mock.invocationCallOrder[0],
    );
    expect(qb.leftJoinAndSelect).toHaveBeenCalledWith('session.user', 'user');
    expect(qb.take).toHaveBeenCalledWith(20);
  });

  it('returns an empty list with coherent metadata', async () => {
    qb.getManyAndCount.mockResolvedValueOnce([[], 0]);
    expect(await service.getAllSessions({})).toEqual({
      data: [],
      meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });
  });

  it.each([{ limit: 101 }, { limit: 0 }, { page: 0 }, { page: 'x' }, { limit: 2.5 }])(
    'rejects invalid query %j',
    async (query) => {
      expect(await validate(plainToInstance(SessionQueryDto, query))).not.toHaveLength(0);
    },
  );

  it('transforms query strings and accepts the maximum limit', async () => {
    const query = plainToInstance(SessionQueryDto, { page: '2', limit: '100' });

    expect(await validate(query)).toHaveLength(0);
    expect(query).toEqual({ page: 2, limit: 100 });
  });
});
