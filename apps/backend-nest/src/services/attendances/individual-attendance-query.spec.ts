import { Repository } from 'typeorm';
import { Attendance } from 'src/entities/attendance/attendance.entity';
import { academicAttendanceCounts } from '@common/utils/attendance-academic-counts';

describe('Academic attendance single-snapshot query', () => {
  it('counts both sides from one materialized session relation and binds academic identity and time', async () => {
    const query = jest
      .fn<Promise<unknown[]>, [string, unknown[]]>()
      .mockResolvedValue([{ enrollmentId: 1, total: 10, present: 3, excused: 1 }]);
    const repository = { query } as unknown as Repository<Attendance>;
    const now = new Date('2026-11-12T14:00Z');
    expect(await academicAttendanceCounts(repository, 20, [1], now)).toEqual([
      { enrollmentId: 1, total: 10, present: 3, excused: 1 },
    ]);
    expect(query).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('WITH computable AS MATERIALIZED'), [
      20,
      [1],
      now,
    ]);
    const sql = String(query.mock.calls[0][0]);
    expect(sql).toContain('FROM computable');
    expect(sql).toContain('JOIN computable');
    expect(sql).toContain("= 'QR'");
    expect(sql).not.toMatch(/observation|password|username/);
  });
  it('does not query for an empty roster', async () => {
    const query = jest.fn();
    expect(
      await academicAttendanceCounts(
        { query } as unknown as Repository<Attendance>,
        1,
        [],
        new Date(),
      ),
    ).toEqual([]);
    expect(query).not.toHaveBeenCalled();
  });
});
