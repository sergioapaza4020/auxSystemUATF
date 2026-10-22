import type * as React from 'react';

import { Alert, Button, DialogTitle } from '@mui/material';
import { describe, expect, it, vi } from 'vitest';

import { elements, hookHarness } from '@/test-utils/hook-harness';
import { GradeSchemeItemsEditor } from '../grade-schemes/components/GradeSchemeItemsEditor';
import { AssistantGradeSchemeDialog } from './AssistantGradeSchemeDialog';

vi.mock('react', async () => ({
  ...(await vi.importActual<typeof React>('react')),
  useState: vi.fn(),
  useEffect: vi.fn(),
  useRef: vi.fn(),
  useMemo: vi.fn(),
  useCallback: vi.fn(),
}));

type Props = Parameters<typeof AssistantGradeSchemeDialog>[0];
type EditorProps = Parameters<typeof GradeSchemeItemsEditor>[0];
type ButtonProps = { children?: React.ReactNode; onClick?: () => void; disabled?: boolean; type?: string };

function setup(hasAcademicData: boolean) {
  const laboratory = { idGradeItem: 3, name: 'Laboratorio', isActive: true };
  const practices = { idGradeItem: 2, name: 'Prácticas', isActive: true };

  const props: Props = {
    open: true,
    loading: false,
    loadingGradeItems: false,
    gradeItems: [practices, laboratory],
    onClose: vi.fn(),
    onSubmit: vi.fn().mockResolvedValue(undefined),
    initialValue: {
      assistantPercentage: 20,
      details: [
        { idGradeSchemeDetail: 20, percentage: 70, order: 1, gradeItem: { idGradeItem: 2 } },
        { idGradeSchemeDetail: 30, percentage: 30, order: 2, gradeItem: { idGradeItem: 3 }, hasAcademicData },
      ],
    },
  };

  const harness = hookHarness(() => AssistantGradeSchemeDialog(props));

  harness.render();

  return { harness, props, laboratory, practices };
}

describe('Assistant criterion removal and redistribution', () => {
  it.each([true, false])('requires explicit confirmation before removing a criterion (data=%s)', (hasData) => {
    const f = setup(hasData);
    let tree = f.harness.render();

    elements<EditorProps>(tree, GradeSchemeItemsEditor)[0].props.onGradeItemChange(f.laboratory, false);
    tree = f.harness.render();
    expect(
      elements<{ children: string }>(tree, DialogTitle).some(
        (title) => title.props.children === (hasData ? 'Desactivar y redistribuir' : 'Eliminar criterio'),
      ),
    ).toBe(true);
    expect(elements<EditorProps>(tree, GradeSchemeItemsEditor)[0].props.details).toHaveLength(2);
    elements<ButtonProps>(tree, Button).find(
      (button) => button.props.children === (hasData ? 'Desactivar y redistribuir' : 'Eliminar y redistribuir'),
    )!.props.onClick!();
    tree = f.harness.render();
    expect(elements<EditorProps>(tree, GradeSchemeItemsEditor)[0].props.totalPercentage).toBe(70);
    expect(elements<ButtonProps>(tree, Button).find((button) => button.props.type === 'submit')!.props.disabled).toBe(
      true,
    );
    elements<EditorProps>(tree, GradeSchemeItemsEditor)[0].props.onPercentageChange(2, 100);
    tree = f.harness.render();
    expect(elements<ButtonProps>(tree, Button).find((button) => button.props.type === 'submit')!.props.disabled).toBe(
      false,
    );
    if (hasData) expect(elements(tree, Alert)).toHaveLength(1);
  });

  it('submits deactivation and new percentages together and displays specific backend errors', async () => {
    const f = setup(true);
    let tree = f.harness.render();

    elements<EditorProps>(tree, GradeSchemeItemsEditor)[0].props.onGradeItemChange(f.laboratory, false);
    tree = f.harness.render();
    elements<ButtonProps>(tree, Button).find((button) => button.props.children === 'Desactivar y redistribuir')!.props
      .onClick!();
    tree = f.harness.render();
    elements<EditorProps>(tree, GradeSchemeItemsEditor)[0].props.onPercentageChange(2, 100);
    tree = f.harness.render();
    const { default: Form } = await import('@components/Form');

    const submit = elements<{ onSubmit: (event: { preventDefault: () => void }) => Promise<void> }>(tree, Form)[0].props
      .onSubmit;

    await submit({ preventDefault: vi.fn() });
    expect(f.props.onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        deactivateDetailIds: [30],
        details: [expect.objectContaining({ percentage: 100 })],
      }),
    );
    vi.mocked(f.props.onSubmit).mockRejectedValueOnce(new Error('El criterio tiene actividades registradas.'));
    await submit({ preventDefault: vi.fn() });
    tree = f.harness.render();
    expect(
      elements<{ children: string }>(tree, Alert).some(
        (alert) => alert.props.children === 'El criterio tiene actividades registradas.',
      ),
    ).toBe(true);
  });
});
