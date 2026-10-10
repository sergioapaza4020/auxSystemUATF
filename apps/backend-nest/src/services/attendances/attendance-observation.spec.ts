import { validate } from 'class-validator';
import { AttendanceRecordDto } from 'src/dtos/attendances/attendance-save.dto';
import { AttendanceStatus } from '@common/enums/attendanceStatus';
import { AttendanceObservation1791662400000 } from 'src/database/migrations/1791662400000-AttendanceObservation';
import { QueryRunner } from 'typeorm';

describe('Optional attendance observations', () => {
  it.each([undefined, null, '', 'Cita médica'])('accepts %s', async (observation) => {
    const dto = Object.assign(new AttendanceRecordDto(), {
      enrollmentId: 1,
      status: AttendanceStatus.EXCUSED,
      observation,
    });
    expect(await validate(dto)).toHaveLength(0);
  });
  it.each([23, 'x'.repeat(501)])('rejects an invalid observation', async (observation) => {
    const dto = Object.assign(new AttendanceRecordDto(), {
      enrollmentId: 1,
      status: AttendanceStatus.EXCUSED,
      observation,
    });
    expect((await validate(dto)).some((error) => error.property === 'observation')).toBe(true);
  });
  it('adds a nullable field without changing historical attendance states', async () => {
    const query = jest.fn();
    const migration = new AttendanceObservation1791662400000();
    await migration.up({ query } as unknown as QueryRunner);
    expect(query).toHaveBeenCalledWith(
      'ALTER TABLE "attendances" ADD "observation" character varying(500)',
    );
    await migration.down({ query } as unknown as QueryRunner);
    expect(query).toHaveBeenLastCalledWith('ALTER TABLE "attendances" DROP COLUMN "observation"');
  });
});
