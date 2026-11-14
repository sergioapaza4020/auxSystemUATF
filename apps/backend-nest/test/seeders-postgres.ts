import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve, sep } from 'node:path';
import { createServer } from 'node:net';
import { DataSource } from 'typeorm';

/** No DATABASE_URL is read. This cluster is created by this process on localhost. */
export async function createSeedTestDatabase(pgBin: string) {
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
  let started = false;
  const source = new DataSource({
    type: 'postgres',
    host: '127.0.0.1',
    port,
    username: 'seeders_test',
    database: 'postgres',
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
        ['-D', directory, '-m', 'fast', '-w', 'stop'],
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
    execFileSync(
      join(pgBin, 'initdb.exe'),
      ['-D', directory, '-U', 'seeders_test', '-A', 'trust', '--no-locale', '--encoding=UTF8'],
      processOptions,
    );
    execFileSync(
      join(pgBin, 'pg_ctl.exe'),
      [
        '-D',
        directory,
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
    await source.initialize();
    const identity: unknown = await source.query(
      "SELECT current_setting('data_directory') AS directory, inet_server_port() AS port",
    );
    const row = (identity as { directory: string; port: number }[])[0];
    if (resolve(row.directory) !== resolve(directory) || row.port !== port)
      throw new Error('Test isolation verification failed');
    return { source, close, port };
  } catch (error: unknown) {
    await close();
    throw error;
  }
}
