import * as React from 'react';

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { ActivitiesGradeSection } from './ActivitiesGradeSection';
import { StudentGradesView } from './StudentGradesView';
import { AcademicCriteria } from '../student-record/AcademicCriteria';
import { StudentGradeCell } from '../StudentGradeCell';
import { GradesSummary } from './GradesSummary';
import type * as AcademicCriteriaModule from '../student-record/AcademicCriteria';
import type * as StudentGradeCellModule from '../StudentGradeCell';
import type { IActivity } from '@/interfaces/activities/activity.interface';
import type { IGrade } from '@/interfaces/grades/grade.interface';
import type { IGradeScheme } from '@/interfaces/grade-schemes/grade-scheme.interface';

vi.mock('../student-record/AcademicCriteria', async (importOriginal) => {
  const actual = await importOriginal<typeof AcademicCriteriaModule>();

  return { ...actual, AcademicCriteria: vi.fn(actual.AcademicCriteria) };
});
vi.mock('../StudentGradeCell', async (importOriginal) => {
  const actual = await importOriginal<typeof StudentGradeCellModule>();

  return { ...actual, StudentGradeCell: vi.fn(actual.StudentGradeCell) };
});
describe('Individual activity grading uses the matrix and summary rule', () => {
  it.each([
    { scores: [80, 70, null], result: 50 },
    { scores: [80, 70, 0], result: 50 },
    { scores: [100, 100, 100], result: 100 },
    { scores: [100, 100, null, null], result: 50 },
  ])('includes missing grades in the divisor for $scores', ({ scores, result }) => {
    const activities: IActivity[] = scores.map((_score, index) => ({
      idActivity: index + 1,
      name: `Entrega ${index + 1}`,
      isActive: true,
      dueDate: '2026-10-15',
    }));

    const inactive = { ...activities[0], idActivity: 999, name: 'Inactiva', isActive: false };

    const grades = [
      ...scores.flatMap((score, index) =>
        score === null
          ? []
          : [{ idGrade: index + 1, score, activity: activities[index], gradeSchemeDetail: { idGradeSchemeDetail: 4 } }],
      ),
      { idGrade: 999, score: 100, activity: inactive, gradeSchemeDetail: { idGradeSchemeDetail: 4 } },
    ] as IGrade[];

    const scheme = {
      idGradeScheme: 1,
      name: 'Esquema',
      isActive: true,
      details: [
        {
          idGradeSchemeDetail: 4,
          percentage: 60,
          order: 1,
          gradeItem: { idGradeItem: 1, name: 'Criterio configurable', isActive: true },
          activities: [...activities, inactive],
        },
      ],
    } as IGradeScheme;

    vi.clearAllMocks();

    const studentHtml = renderToStaticMarkup(
      <StudentGradesView scheme={scheme} grades={grades} loading={false} schemeMultiplier={0.2} maximumScore={20} />,
    );

    const criteria = vi.mocked(AcademicCriteria).mock.calls[0][0];
    const summary = vi.mocked(StudentGradeCell).mock.calls[0][0];

    expect(criteria.results[0].rawScore).toBe(result);
    expect(summary.score).toBe(result * 0.12);
    expect(studentHtml).not.toContain('Inactiva');
    if (scores.includes(null)) expect(studentHtml).toContain('--');

    const summaryHtml = renderToStaticMarkup(
      <GradesSummary evaluatedPercentage={60} currentScore={Number(summary.score)} maximumScore={20} />,
    );

    expect(summaryHtml).toContain((result * 0.12).toFixed(2));

    const section = ActivitiesGradeSection({
      name: 'Criterio configurable',
      percentage: 60,
      activities: [...activities, inactive],
      grades,
      scores: Object.fromEntries(scores.map((score, index) => [index + 1, score === null ? '' : String(score)])),
      saving: null,
      schemeMultiplier: 0.2,
      isInvalidScore: () => false,
      onScoreChange: vi.fn(),
      onSave: vi.fn(),
      onDelete: vi.fn(),
    });

    const html = renderToStaticMarkup(section);

    expect(html).toContain(`${result.toFixed(2)} / 100`);
    expect(html).not.toContain('Inactiva');
    if (scores.includes(null)) expect(html).toContain('placeholder="--"');
  });
});
