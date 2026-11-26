import { User } from 'src/entities/users/users.entity';

/** Repository transaction adapter for isolated auth tests (no database connection). */
export function withSessionTransaction<T extends object>(repository: T) {
  return {
    ...repository,
    manager: {
      transaction: jest.fn(
        async <R>(work: (manager: { getRepository: (entity?: unknown) => T }) => Promise<R>) =>
          work({
            getRepository: (entity?: unknown) => {
              if (entity === User) {
                return {
                  findOne: jest.fn(({ where }: { where: { idUser: number } }) =>
                    Promise.resolve(
                      Object.assign(new User(), { idUser: where.idUser, isActive: true }),
                    ),
                  ),
                } as unknown as T;
              }
              return repository;
            },
          }),
      ),
    },
  };
}
