import { DataSource, QueryFailedError } from 'typeorm';
import { runSeeders, SeedExecutionError } from './seed-runner';
import { SeedDataError, SeedRowError } from './utils/seed-integrity';

describe('Seed execution safety', () => {
  it('reports SQLSTATE, table, constraint, operation and row without parameters, detail or raw messages', () => {
    const privateValue = 'PRIVATE-DO-NOT-LOG';
    const driver = Object.assign(new Error(privateValue), {
      code: '23505',
      table: 'enrollments',
      constraint: 'UQ_f0c733a26362d184c12a54f9249',
      detail: privateValue,
    });
    const failure = new QueryFailedError(
      'INSERT INTO enrollments VALUES ($1)',
      [privateValue],
      driver,
    );
    const error = new SeedExecutionError('EnrollmentSeeder', new SeedRowError(1, failure));
    expect(error.message).toContain('EnrollmentSeeder fila=1');
    expect(error.message).toContain('SQLSTATE=23505');
    expect(error.message).toContain('tabla=enrollments');
    expect(error.message).toContain('constraint=UQ_f0c733a26362d184c12a54f9249');
    expect(error.message).toContain('operación=INSERT');
    expect(error.message).not.toContain(privateValue);
    expect(error.message).not.toContain('VALUES');
  });

  it('does not log unexpected exception messages but retains safe business explanations', () => {
    expect(new SeedExecutionError('UserSeeder', new Error('PRIVATE')).message).not.toContain(
      'PRIVATE',
    );
    expect(
      new SeedExecutionError('UserSeeder', new SeedDataError('Conflicto de identidad.')).message,
    ).toContain('Conflicto de identidad.');
  });

  it('rejects demo accounts in production or an unspecified environment before any connection operation', async () => {
    const createQueryRunner = jest.fn();
    const source = { createQueryRunner } as unknown as DataSource;
    for (const environment of ['production', undefined]) {
      await expect(runSeeders(source, { includeDemoData: true, environment })).rejects.toThrow(
        SeedDataError,
      );
    }
    expect(createQueryRunner).not.toHaveBeenCalled();
  });

  it('requires migration history and releases the inspection connection without starting a seed transaction', async () => {
    const runner = { hasTable: jest.fn().mockResolvedValue(false), release: jest.fn() };
    const transaction = jest.fn();
    const source = { createQueryRunner: () => runner, transaction } as unknown as DataSource;
    await expect(runSeeders(source)).rejects.toThrow('Falta el historial');
    expect(runner.release).toHaveBeenCalledTimes(1);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('stops on pending migrations before any seed transaction', async () => {
    const runner = { hasTable: jest.fn().mockResolvedValue(true), release: jest.fn() };
    const transaction = jest.fn();
    const source = {
      createQueryRunner: () => runner,
      showMigrations: jest.fn().mockResolvedValue(true),
      transaction,
    } as unknown as DataSource;
    await expect(runSeeders(source)).rejects.toThrow('migraciones pendientes');
    expect(transaction).not.toHaveBeenCalled();
    expect(runner.release).toHaveBeenCalledTimes(1);
  });
});
