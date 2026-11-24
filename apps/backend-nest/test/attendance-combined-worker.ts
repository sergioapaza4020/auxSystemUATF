// Test-only process: it cannot select an application URL or write before isolation checks.
import { basename, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { DataSource } from 'typeorm';
import { HttpException } from '@nestjs/common';
import { AttendanceSession } from '../src/entities/attendance/attendance-session.entity';
import { Attendance } from '../src/entities/attendance/attendance.entity';
import { Enrollment } from '../src/entities/enrollments/enrollments.entity';
import { AttendancesService } from '../src/services/attendances/attendances.service';

async function run() {
  let input = '';
  for await (const chunk of process.stdin) input += String(chunk);
  const value: unknown = JSON.parse(input);
  if (
    !value ||
    typeof value !== 'object' ||
    !('port' in value) ||
    typeof value.port !== 'number' ||
    value.port < 1024 ||
    value.port > 65535 ||
    !('directory' in value) ||
    typeof value.directory !== 'string' ||
    !('id' in value) ||
    typeof value.id !== 'number' ||
    !Number.isSafeInteger(value.id) ||
    value.id < 1 ||
    !('authorization' in value) ||
    typeof value.authorization !== 'string'
  )
    throw new Error('Invalid isolated fixture input');
  const directory = resolve(value.directory);
  if (
    !directory.startsWith(resolve(tmpdir()) + sep) ||
    !basename(directory).startsWith('seeders-pg-')
  )
    throw new Error('Not a disposable cluster');
  const source = new DataSource({
    type: 'postgres',
    host: '127.0.0.1',
    port: value.port,
    username: 'seeders_test',
    database: 'postgres',
    entities: [resolve('src/**/*.entity.ts')],
    synchronize: false,
    installExtensions: false,
    logging: false,
  });
  try {
    await source.initialize();
    const identity: unknown = await source.query(
      "SELECT current_setting('data_directory') AS directory,inet_server_port() AS port,current_database() AS database,host(inet_server_addr()) AS host",
    );
    if (!Array.isArray(identity)) throw new Error('Missing test identity');
    const row: unknown = identity[0];
    if (
      !row ||
      typeof row !== 'object' ||
      !('directory' in row) ||
      typeof row.directory !== 'string' ||
      resolve(row.directory) !== directory ||
      !('port' in row) ||
      row.port !== value.port ||
      !('database' in row) ||
      row.database !== 'postgres' ||
      !('host' in row) ||
      row.host !== '127.0.0.1'
    )
      throw new Error('Test cluster identity mismatch');
    const api = new AttendancesService(
      source.getRepository(AttendanceSession),
      source.getRepository(Attendance),
      source.getRepository(Enrollment),
    );
    try {
      const result = await api.combinedCheckIn(2, value.id, {
        authorization: value.authorization,
        latitude: -19.57,
        longitude: -65.75,
        accuracy: 10,
      });
      process.stdout.write(result.code);
    } catch (error) {
      const response: unknown = error instanceof HttpException ? error.getResponse() : null;
      if (
        response &&
        typeof response === 'object' &&
        'code' in response &&
        typeof response.code === 'string'
      )
        process.stdout.write(response.code);
      else throw new Error('Isolated worker operation failed');
    }
  } finally {
    if (source.isInitialized) await source.destroy();
  }
}
void run().catch(() => {
  process.stderr.write('COMB isolated worker failed');
  process.exitCode = 1;
});
