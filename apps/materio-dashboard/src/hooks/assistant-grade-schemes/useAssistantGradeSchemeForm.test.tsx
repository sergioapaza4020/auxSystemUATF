import * as React from 'react';

import { TextField } from '@mui/material';
import { renderToStaticMarkup } from 'react-dom/server';

import { describe, expect, it, vi } from 'vitest';

import { GradeSchemeItemsEditor } from '@/views/admin/grade-schemes/components/GradeSchemeItemsEditor';

import { useAssistantGradeSchemeForm } from './useAssistantGradeSchemeForm';

function Validation({ weight }: { weight?: number }) {
  const result = useAssistantGradeSchemeForm({
    initialValue: {
      assistantPercentage: 20,
      details: [{ percentage: 100, order: 1, gradeItem: { idGradeItem: 1 }, permissionWeight: weight }],
    },
  });

  return <span>{String(result.isValid)}</span>;
}

function fields(tree: React.ReactNode): React.ReactElement<Record<string, unknown>>[] {
  const result: React.ReactElement<Record<string, unknown>>[] = [];

  React.Children.forEach(tree, (child) => {
    if (!React.isValidElement<Record<string, unknown>>(child)) return;
    if (child.type === TextField) result.push(child);
    result.push(...fields(child.props.children as React.ReactNode));
  });

  return result;
}

describe('Assistant attendance configuration', () => {
  it.each([0, 25, 33.3, 50, 50.5, 62.5, 99, 100])('sends a normalized weight when entering %s%%', (percentage) => {
    const onPermissionWeightChange = vi.fn();

    const tree = GradeSchemeItemsEditor({
      gradeItems: [{ idGradeItem: 1, name: 'Asistencias', isActive: true }],
      details: [{ percentage: 100, order: 1, gradeItem: { idGradeItem: 1 }, permissionWeight: 0.5 }],
      loading: false,
      totalPercentage: 100,
      onGradeItemChange: () => {},
      onPercentageChange: () => {},
      onPermissionWeightChange,
    });

    const input = fields(tree).find((field) => field.props.label === 'Valor del permiso');

    expect(input).toBeDefined();
    expect(input?.props.inputProps).toMatchObject({ min: 0, max: 100, step: 'any' });
    (input?.props.onChange as (event: { target: { value: string } }) => void)({
      target: { value: String(percentage) },
    });
    expect(onPermissionWeightChange.mock.calls[0][0]).toBe(1);
    expect(onPermissionWeightChange.mock.calls[0][1]).toBeCloseTo(percentage / 100, 12);
  });
  it('shows the saved permission weight only for the selected attendance criterion', () => {
    const html = renderToStaticMarkup(
      <GradeSchemeItemsEditor
        gradeItems={[
          { idGradeItem: 1, name: 'Asistencias', isActive: true },
          { idGradeItem: 2, name: 'Proyecto', isActive: true },
        ]}
        details={[
          { percentage: 40, order: 1, gradeItem: { idGradeItem: 1 }, permissionWeight: 0.5 },
          { percentage: 60, order: 2, gradeItem: { idGradeItem: 2 } },
        ]}
        loading={false}
        totalPercentage={100}
        onGradeItemChange={() => {}}
        onPercentageChange={() => {}}
        onPermissionWeightChange={() => {}}
      />,
    );

    expect(html).toContain('value="50"');
    expect(html).toContain('Define qué porcentaje de una asistencia completa aporta un permiso.');
    expect(html).toContain('Valor del permiso (%)');
  });
  it.each([undefined, 0, 0.005, 0.5, 1])('accepts %s including the historical default', (weight) => {
    expect(renderToStaticMarkup(<Validation weight={weight} />)).toContain('true');
  });
  it.each([-0.01, 1.01, Number.NaN, Number.POSITIVE_INFINITY])('rejects %s', (weight) => {
    expect(renderToStaticMarkup(<Validation weight={weight} />)).toContain('false');
  });
});
