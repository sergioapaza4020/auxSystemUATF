import AppDataSource from './datasource';
import { runSeeders, SeedExecutionError } from './seed-runner';
import { SeedDataError } from './utils/seed-integrity';

async function seed() {
  try {
    await AppDataSource.initialize();
    await runSeeders(AppDataSource, {
      includeDemoData: process.env.SEED_DEMO_DATA === 'true',
      environment: process.env.NODE_ENV,
      log: console.log,
    });
    console.log('Seed completed');
  } catch (error: unknown) {
    console.error(
      error instanceof SeedExecutionError || error instanceof SeedDataError
        ? error.message
        : 'Seed falló al conectar o verificar el esquema; revisar conexión y migraciones sin exponer credenciales.',
    );
    process.exitCode = 1;
  } finally {
    if (AppDataSource.isInitialized) await AppDataSource.destroy();
  }
}

void seed();
