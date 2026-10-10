import { weightedScore } from '@repo/grade-calculations';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AttendanceStatus as S } from '@common/enums/attendanceStatus';
import { AssistantGradeSchemeDetailDto } from 'src/dtos/assistant-grade-schemes/assistant-grade-scheme.dto';
import { DetailCreateDto } from 'src/dtos/grade-schemes/grade-schemes.dto';
import { AttendanceRecordDto } from 'src/dtos/attendances/attendance-save.dto';
import { summarizeAttendanceStatuses } from './attendance-summary';

describe('Academic attendance', () => {
  it('includes missing marks and preserves historical PRESENT/ABSENT', () => {
    const result = summarizeAttendanceStatuses([S.PRESENT, S.PRESENT, S.PRESENT, S.ABSENT], 7);
    expect(result).toEqual({
      present: 3,
      excused: 0,
      absent: 4,
      total: 7,
      percentage: (3 / 7) * 100,
    });
  });
  it.each([1, 0.5, 0])('weights permission by %s without changing its category', (weight) => {
    const result = summarizeAttendanceStatuses(
      [S.PRESENT, S.PRESENT, S.PRESENT, S.PRESENT, S.PRESENT, S.EXCUSED, S.ABSENT],
      7,
      weight,
    );
    expect(result.percentage).toBeCloseTo(((5 + weight) / 7) * 100, 8);
    expect(result.excused).toBe(1);
    expect(result.present + result.excused + result.absent).toBe(result.total);
  });
  it.each([
    { present: 10, excused: 0, weight: 0.5, expected: 6 },
    { present: 9, excused: 0, weight: 0.5, expected: 5.4 },
    { present: 9, excused: 1, weight: 0.5, expected: 5.7 },
    { present: 8, excused: 1, weight: 0.5, expected: 5.1 },
    { present: 9, excused: 1, weight: 1, expected: 6 },
    { present: 9, excused: 1, weight: 0, expected: 5.4 },
  ])(
    'derives a six-point criterion from $present present and $excused excused with weight $weight',
    ({ present, excused, weight, expected }) => {
      const statuses = [...Array<S>(present).fill(S.PRESENT), ...Array<S>(excused).fill(S.EXCUSED)];
      const result = summarizeAttendanceStatuses(statuses, 10, weight);
      expect(weightedScore(result.percentage, 6)).toBeCloseTo(expected, 10);
      expect(result.excused).toBe(excused);
      expect(result.present + result.excused + result.absent).toBe(10);
    },
  );
  it('recomputes the criterion when more unmarked sessions are created', () => {
    const statuses = [...Array<S>(9).fill(S.PRESENT), S.EXCUSED];
    expect(weightedScore(summarizeAttendanceStatuses(statuses, 10, 0.5).percentage, 6)).toBeCloseTo(
      5.7,
      10,
    );
    expect(weightedScore(summarizeAttendanceStatuses(statuses, 20, 0.5).percentage, 6)).toBeCloseTo(
      2.85,
      10,
    );
  });
  it('counts an unmarked session as all absent', () => {
    expect(summarizeAttendanceStatuses([], 9)).toEqual({
      present: 0,
      excused: 0,
      absent: 9,
      total: 9,
      percentage: 0,
    });
    expect(summarizeAttendanceStatuses([], 0).percentage).toBe(0);
  });
  it.each([
    -0.01,
    1.01,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    '0.5',
    'invalid',
  ])('rejects invalid permission weight %s in both scheme DTOs', async (weight) => {
    for (const dto of [AssistantGradeSchemeDetailDto, DetailCreateDto]) {
      const errors = await validate(
        plainToInstance(dto, {
          percentage: 40,
          order: 1,
          gradeItem: { idGradeItem: 1 },
          permissionWeight: weight,
        }),
      );
      expect(errors.some((error) => error.property === 'permissionWeight')).toBe(true);
    }
  });
  it.each([0, 0.005, 0.3333, 0.505, 0.625, 0.99, 1])(
    'accepts permission weight %s',
    async (permissionWeight) => {
      expect(
        await validate(
          plainToInstance(AssistantGradeSchemeDetailDto, {
            percentage: 40,
            order: 1,
            gradeItem: { idGradeItem: 1 },
            permissionWeight,
          }),
        ),
      ).toEqual([]);
    },
  );
  it.each([S.PRESENT, S.EXCUSED, S.ABSENT])(
    'accepts %s through the attendance DTO',
    async (status) => {
      expect(
        await validate(plainToInstance(AttendanceRecordDto, { enrollmentId: 1, status })),
      ).toEqual([]);
    },
  );
});
