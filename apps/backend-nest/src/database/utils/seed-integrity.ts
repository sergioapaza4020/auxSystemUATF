import { FindOptionsWhere, Repository } from 'typeorm';

/** Messages must describe the conflict without including identity values or secrets. */
export class SeedDataError extends Error {}

export class SeedRowError extends Error {
  constructor(
    public readonly row: number,
    cause: unknown,
  ) {
    super(`Seed row ${row} failed`, { cause });
  }
}

export async function findSeedRecord<T extends object>(
  repository: Repository<T>,
  where: FindOptionsWhere<T>,
  label: string,
): Promise<T | null> {
  const matches = await repository.find({ where, withDeleted: true, take: 2 });
  if (matches.length > 1)
    throw new SeedDataError(`${label}: referencia ambigua; revisar los duplicados existentes.`);
  return matches[0] ?? null;
}

export async function requireSeedReference<
  T extends { isActive?: boolean; deletedAt?: Date | null },
>(repository: Repository<T>, where: FindOptionsWhere<T>, label: string): Promise<T> {
  const record = await findSeedRecord(repository, where, label);
  if (!record)
    throw new SeedDataError(`${label}: falta el registro padre; ejecutar primero su seeder.`);
  if (record.isActive === false || record.deletedAt) {
    throw new SeedDataError(
      `${label}: el registro padre está inactivo o eliminado; no se reactivará automáticamente.`,
    );
  }
  return record;
}
