import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { matchesRefresh } from '@common/utils/refresh-digest';
import { UserSession } from 'src/entities/user-sessions/user-sessions.entity';
import { User } from 'src/entities/users/users.entity';
import { SessionsService } from './sessions.service';

describe('Transactional session issuance', () => {
  async function fixture(failFinalWrite = false) {
    const writes: Partial<UserSession>[] = [];
    let committed = false;
    const repository = {
      create: (values: Partial<UserSession>) => Object.assign(new UserSession(), values),
      save: jest.fn((session: UserSession) => {
        session.idSession = 7;
        writes.push({ ...session });
        if (failFinalWrite && writes.length === 2) throw new Error('final write failed');
        return Promise.resolve(session);
      }),
    };
    const accountRepository = {
      findOne: jest.fn(({ where }: { where: { idUser: number } }) =>
        Promise.resolve(Object.assign(new User(), { idUser: where.idUser, isActive: true })),
      ),
    };
    const transaction = jest.fn(
      async <R>(work: (manager: { getRepository: () => typeof repository }) => Promise<R>) => {
        const result = await work({
          getRepository: (entity?: unknown) =>
            (entity === User ? accountRepository : repository) as typeof repository,
        });
        committed = true;
        return result;
      },
    );
    const module = await Test.createTestingModule({
      providers: [
        SessionsService,
        { provide: getRepositoryToken(UserSession), useValue: { manager: { transaction } } },
      ],
    }).compile();
    const create = (issueTokens: Parameters<SessionsService['createSession']>[0]['issueTokens']) =>
      module.get(SessionsService).createSession({
        user: Object.assign(new User(), { idUser: 1 }),
        lastUsedAt: new Date(),
        issueTokens,
      });
    return { create, writes, transaction, committed: () => committed };
  }

  it('obtains the id before issuing tokens and commits only with a refresh hash', async () => {
    const f = await fixture();
    const issue = jest.fn((idSession: number) => {
      expect(idSession).toBe(7);
      expect(f.writes[0].isActive).toBe(false);
      return { accessToken: 'access-test', refreshToken: 'refresh-test' };
    });
    const result = await f.create(issue);
    expect(f.transaction).toHaveBeenCalledTimes(1);
    expect(f.committed()).toBe(true);
    expect(result.userSession.isActive).toBe(true);
    expect(result.userSession.refreshToken).toMatch(/^sha256:v1:/);
    expect(await matchesRefresh('refresh-test', result.userSession.refreshToken)).toBe(true);
    expect(f.writes).toHaveLength(2);
  });

  it('propagates signing failure out of the transaction without an active write', async () => {
    const f = await fixture();
    await expect(
      f.create(() => {
        throw new Error('signing failed');
      }),
    ).rejects.toThrow('signing failed');
    expect(f.committed()).toBe(false);
    expect(f.writes.every((value) => value.isActive === false)).toBe(true);
  });

  it('does not complete the transaction or return tokens when final persistence fails', async () => {
    const f = await fixture(true);
    await expect(
      f.create(() => ({ accessToken: 'access-test', refreshToken: 'refresh-test' })),
    ).rejects.toThrow('final write failed');
    expect(f.committed()).toBe(false);
  });
});
