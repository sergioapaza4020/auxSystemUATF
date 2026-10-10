import { describe, expect, it } from 'vitest';

import type { IGradeMatrix } from '@/interfaces/grades/grade-matrix.interface';
import {
  buildGradePayload,
  getGradeChanges,
  gradeCellKey,
  mergeMatrixOriginals,
  nextStudentCell,
  parseGradeDraft,
  studentCriterionResult,
} from './grade-matrix-state';

export const matrixFixture: IGradeMatrix = {
  enrollment: {
    idEnrollment: 1,
    idCourse: 7,
    code: 'SIS-1',
    name: 'Materia',
    group: 1,
    assistantName: 'Auxiliar Actual',
  },
  scheme: { idGradeScheme: 1, assistantPercentage: 20 },
  criteria: [{ idGradeSchemeDetail: 4, name: 'Criterio dinámico', percentage: 60, activityCount: 2 }],
  detail: { idGradeSchemeDetail: 4, name: 'Criterio dinámico', percentage: 60 },
  activities: [
    { idActivity: 10, name: 'Actividad B', dueDate: '2026-10-15', publicationDate: null, description: null },
    { idActivity: 11, name: 'Actividad A', dueDate: '2026-10-22', publicationDate: null, description: null },
  ],
  students: [
    { idEnrollment: 100, name: 'Juan', lastname: 'Pérez', ci: 'CI1', ru: 'RU1' },
    { idEnrollment: 101, name: 'Ana', lastname: 'Flores', ci: 'CI2', ru: 'RU2' },
  ],
  grades: [{ idGrade: 1, enrollmentId: 100, activityId: 10, score: 80 }],
};

describe('Grade drafts shared by both views', () => {
  it.each([
    { scores: [80, 70, null], expected: 50 },
    { scores: [80, 70, 0], expected: 50 },
    { scores: [100, 100, 100], expected: 100 },
    { scores: [100, 100, null, null], expected: 50 },
  ])('counts all active activities for $scores', ({ scores, expected }) => {
    const ids = scores.map((_score, index) => index + 1);
    const originals = Object.fromEntries(scores.map((score, index) => [`100:${index + 1}`, score]));

    expect(studentCriterionResult(100, ids, originals, {})).toBe(expected);
    expect(studentCriterionResult(100, [1, 2], { ...originals, '100:999': 100 }, {})).toBe(
      (scores[0]! + scores[1]!) / 2,
    );
  });
  it('hydrates the complete student × activity matrix and keeps missing scores null', () => {
    expect(mergeMatrixOriginals(matrixFixture, {}, {})).toEqual({
      '100:10': 80,
      '100:11': null,
      '101:10': null,
      '101:11': null,
    });
  });
  it.each([0, 100])('accepts real score %s separately from an empty score', (score) => {
    expect(parseGradeDraft(String(score), null)).toEqual({ score, error: null });
    expect(parseGradeDraft('', null)).toEqual({ score: null, error: null });
  });
  it.each(['-1', '101', 'texto'])('marks %s invalid without coercing it to zero', (value) => {
    expect(parseGradeDraft(value, null).error).not.toBeNull();
  });
  it('does not silently delete an existing grade when its input is cleared', () => {
    expect(parseGradeDraft('', 80).error).not.toBeNull();
    expect(() => buildGradePayload({ '100:10': 80 }, { '100:10': '' })).toThrow();
  });
  it('tracks several dirty cells and saves only semantic changes', () => {
    const originals = mergeMatrixOriginals(matrixFixture, {}, {});
    const drafts = { '100:10': '80.0', '100:11': '0', '101:10': '100', '101:11': '' };

    expect(getGradeChanges(originals, drafts)).toHaveLength(2);
    expect(buildGradePayload(originals, drafts)).toEqual([
      { enrollmentId: 100, activityId: 11, score: 0 },
      { enrollmentId: 101, activityId: 10, score: 100 },
    ]);
  });
  it('has no request payload for reverted or untouched cells', () => {
    expect(buildGradePayload({ '100:10': 80 }, {})).toEqual([]);
    expect(buildGradePayload({ '100:10': 80 }, { '100:10': '80' })).toEqual([]);
  });
  it('keeps edits and their original values across criterion loads', () => {
    const originals = mergeMatrixOriginals(matrixFixture, {}, {});
    const drafts = { '100:10': '90' };
    const other = { ...matrixFixture, activities: [{ ...matrixFixture.activities[0], idActivity: 22 }], grades: [] };
    const merged = mergeMatrixOriginals(other, originals, drafts);

    expect(merged['100:10']).toBe(80);
    expect(buildGradePayload(merged, drafts)).toEqual([{ enrollmentId: 100, activityId: 10, score: 90 }]);
    const changedByAnotherUser = { ...matrixFixture, grades: [{ ...matrixFixture.grades[0], score: 50 }] };

    expect(mergeMatrixOriginals(changedByAnotherUser, merged, drafts)['100:10']).toBe(80);
  });
  it('uses every active activity in the mean, including missing grades and genuine zero', () => {
    const originals = mergeMatrixOriginals(matrixFixture, {}, {});

    expect(studentCriterionResult(100, [10, 11], originals, {})).toBe(40);
    expect(studentCriterionResult(101, [10, 11], originals, {})).toBe(0);
    expect(studentCriterionResult(100, [10, 11], originals, { '100:11': '0' })).toBe(40);
    expect(studentCriterionResult(100, [10, 11], originals, { '100:11': '101' })).toBeNull();
  });
  it('retains stable keys independently of searching, pagination and view mode', () => {
    const drafts = { [gradeCellKey(100, 11)]: '75' };
    const originals = mergeMatrixOriginals(matrixFixture, {}, {});
    const filtered = matrixFixture.students.filter((student) => student.ci === 'CI2').slice(0, 1);

    expect(filtered[0].idEnrollment).toBe(101);
    expect(buildGradePayload(originals, drafts)[0]).toEqual({ enrollmentId: 100, activityId: 11, score: 75 });
  });
  it('moves vertically within the same activity and handles page boundaries by stable identity', () => {
    expect(nextStudentCell(100, 11, [100, 101, 102], 1)).toBe('101:11');
    expect(nextStudentCell(101, 11, [100, 101, 102], -1)).toBe('100:11');
    expect(nextStudentCell(102, 11, [100, 101, 102], 1)).toBeNull();
  });
});
