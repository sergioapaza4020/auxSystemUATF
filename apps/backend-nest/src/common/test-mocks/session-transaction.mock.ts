/** Repository transaction adapter for isolated auth tests (no database connection). */
export function withSessionTransaction<T extends object>(repository: T) {
  return {
    ...repository,
    manager: {
      transaction: jest.fn(async <R>(work: (manager: { getRepository: () => T }) => Promise<R>) =>
        work({ getRepository: () => repository }),
      ),
    },
  };
}
