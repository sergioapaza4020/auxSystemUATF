import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { tmpdir } from 'node:os';
import { basename, join, resolve, sep } from 'node:path';
import { createServer } from 'node:net';
import { DataSource } from 'typeorm';

/** No DATABASE_URL is read. This cluster is created by this process on localhost. */
export async function createSeedTestDatabase(pgBin: string, isolatedCredentials = false) {
  const root = resolve(tmpdir());
  const directory = mkdtempSync(join(root, 'seeders-pg-'));
  const port = await new Promise<number>((accept, reject) => {
    const server = createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string')
        return reject(new Error('No isolated test port'));
      server.close((error) => (error ? reject(error) : accept(address.port)));
    });
  });
  const processOptions = { stdio: 'ignore' as const, windowsHide: true, timeout: 30000 };
  const username = isolatedCredentials ? 'rem32_test' : 'seeders_test';
  const database = isolatedCredentials ? 'rem32_test' : 'postgres';
  const password = isolatedCredentials ? randomBytes(32).toString('hex') : undefined;
  const dataDirectory = password ? join(directory, 'data') : directory;
  let started = false;
  const source = new DataSource({
    type: 'postgres',
    host: '127.0.0.1',
    port,
    username,
    database,
    password,
    ...(isolatedCredentials ? { ssl: false } : {}),
    entities: [resolve('src/**/*.entity.ts')],
    migrations: [resolve('src/database/migrations/*.ts')],
    synchronize: false,
    installExtensions: false,
    logging: false,
  });
  async function close() {
    if (source.isInitialized) await source.destroy();
    if (started) {
      execFileSync(
        join(pgBin, 'pg_ctl.exe'),
        ['-D', dataDirectory, '-m', 'fast', '-w', 'stop'],
        processOptions,
      );
      started = false;
    }
    const target = resolve(directory);
    if (!target.startsWith(root + sep) || !basename(target).startsWith('seeders-pg-')) {
      throw new Error('Refusing cleanup outside the test cluster');
    }
    rmSync(target, { recursive: true, force: true });
  }
  try {
    const passwordFile = join(directory, 'init-password');
    // initdb requires an empty data directory. Put its transient password file beside it.
    if (password) writeFileSync(passwordFile, password, { flag: 'wx', mode: 0o600 });
    execFileSync(
      join(pgBin, 'initdb.exe'),
      [
        '-D',
        dataDirectory,
        '-U',
        username,
        '-A',
        password ? 'scram-sha-256' : 'trust',
        ...(password ? [`--pwfile=${passwordFile}`] : []),
        '--no-locale',
        '--encoding=UTF8',
      ],
      processOptions,
    );
    if (password) unlinkSync(passwordFile);
    execFileSync(
      join(pgBin, 'pg_ctl.exe'),
      [
        '-D',
        dataDirectory,
        '-l',
        join(directory, 'server.log'),
        '-o',
        `-h 127.0.0.1 -p ${port} -F`,
        '-w',
        'start',
      ],
      processOptions,
    );
    started = true;
    if (password) {
      // libpq reads PGHOSTADDR and service settings even when --host is explicit.
      const localEnvironment = Object.fromEntries(
        Object.entries(process.env).filter(([name]) => !/^PG/i.test(name)),
      );
      execFileSync(
        join(pgBin, 'createdb.exe'),
        [
          '-h',
          '127.0.0.1',
          '-p',
          String(port),
          '-U',
          username,
          '--no-password',
          '--maintenance-db=postgres',
          database,
        ],
        { ...processOptions, env: { ...localEnvironment, PGPASSWORD: password } },
      );
    }
    await source.initialize();
    const identity: unknown = await source.query(
      `SELECT current_setting('data_directory') AS directory, inet_server_port() AS port,
              current_user AS username, current_database() AS database`,
    );
    const row = (
      identity as { directory: string; port: number; username: string; database: string }[]
    )[0];
    if (
      resolve(row.directory) !== resolve(dataDirectory) ||
      row.port !== port ||
      row.username !== username ||
      row.database !== database
    )
      throw new Error('Test isolation verification failed');
    return { source, close, port };
  } catch (error: unknown) {
    await close();
    throw error;
  }
}
