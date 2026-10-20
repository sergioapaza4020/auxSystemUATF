import * as React from 'react';

import type * as Mui from '@mui/material';

import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { assistantGradeItemLabel, isAssistantGradeItem } from '@repo/grade-calculations/assistant-grade-items';

import { AssistantGradeSchemeDialog } from '@/views/admin/enrollments/AssistantGradeSchemeDialog';
import { AssistantGradeSchemeForm } from '@/views/assistant/grade-schemes/AssistantGradeSchemeForm';
import { GradeSchemeItemsEditor } from '@/views/admin/grade-schemes/components/GradeSchemeItemsEditor';
import type { IAssistantGradeSchemeCreate } from '@/interfaces/grade-schemes/assistant-grade-scheme.interface';

import { useAssistantGradeSchemeForm } from './useAssistantGradeSchemeForm';

const { catalog } = vi.hoisted(() => ({
  catalog: ['Prácticas', 'Laboratorio', 'Asistencias', 'Participación', 'Examen final', 'Parcial', 'Segundo turno'].map(
    (name, index) => ({ idGradeItem: 809 + index * 23, name, isActive: true }),
  ),
}));

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof React>('react');

  return {
    ...actual,
    useState: vi.fn(actual.useState),
    useMemo: vi.fn(actual.useMemo),
    useEffect: vi.fn(actual.useEffect),
  };
});
vi.mock('@mui/material', async () => {
  const actual = await vi.importActual<typeof Mui>('@mui/material');

  // Render dialog content without a browser portal in the project's Node test environment.
  return { ...actual, Dialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div> };
});
vi.mock('@/hooks/grade-items', () => ({ useGradeItems: () => ({ gradeItems: catalog, loading: false }) }));
vi.mock('@/hooks/assistant-grade-schemes/useAssistantGradeScheme', () => ({
  useAssistantGradeScheme: () => ({ create: vi.fn() }),
}));

afterEach(() => vi.clearAllMocks());

const initialValue: IAssistantGradeSchemeCreate = {
  assistantPercentage: 20,
  name: 'Mi evaluación',
  details: [
    { gradeItem: { idGradeItem: catalog[0].idGradeItem }, percentage: 70, order: 1 },
    { gradeItem: { idGradeItem: catalog[2].idGradeItem }, percentage: 30, permissionWeight: 0.5, order: 2 },
  ],
};

function dialog(initial?: IAssistantGradeSchemeCreate) {
  return renderToStaticMarkup(
    <AssistantGradeSchemeDialog
      open
      loading={false}
      gradeItems={catalog}
      loadingGradeItems={false}
      initialValue={initial}
      onClose={() => {}}
      onSubmit={async () => {}}
    />,
  );
}

describe('Assistant criterion options', () => {
  it.each(['dialog', 'standalone'])('shows only the four allowed options in %s', (view) => {
    const html = view === 'dialog' ? dialog() : renderToStaticMarkup(<AssistantGradeSchemeForm idCourse={19} />);

    for (const label of ['Prácticas', 'Laboratorio', 'Asistencia', 'Participación']) {
      expect(html).toContain(`Seleccionar ${label}"`);
    }

    for (const label of ['Examen final', 'Parcial', 'Segundo turno']) expect(html).not.toContain(label);
    expect(html.match(/aria-label="Seleccionar /g)).toHaveLength(4);
  });

  it('edits an existing subset with saved percentages and the historical attendance controls', () => {
    const html = dialog(initialValue);

    expect(html).toContain('Guardar cambios');
    expect(html).toContain('value="70"');
    expect(html).toContain('value="30"');
    expect(html).toContain('value="50"');
    expect(html).toContain('Valor del permiso');
    expect(html.match(/checked=""/g)).toHaveLength(2);
  });

  it('keeps the general editor catalog unchanged', () => {
    const html = renderToStaticMarkup(
      <GradeSchemeItemsEditor
        gradeItems={catalog}
        details={[]}
        loading={false}
        totalPercentage={0}
        onGradeItemChange={() => {}}
        onPercentageChange={() => {}}
      />,
    );

    expect(html).toContain('Examen final');
    expect(html).toContain('Parcial');
    expect(html).toContain('Segundo turno');
  });

  it('recognizes normalized names without changing persisted IDs or names', () => {
    expect(isAssistantGradeItem({ name: '  PRACTICAS ' })).toBe(true);
    expect(isAssistantGradeItem({ name: 'participación' })).toBe(true);
    expect(assistantGradeItemLabel('Asistencias')).toBe('Asistencia');
    expect(isAssistantGradeItem({ name: 'Prácticas de examen' })).toBe(false);
    expect(isAssistantGradeItem({ name: 'toString' })).toBe(false);
    expect(catalog.filter(isAssistantGradeItem)[2]).toBe(catalog[2]);
  });

  it('does not duplicate selections and keeps percentage validation for subsets', () => {
    let state = structuredClone(initialValue);

    const Render = () => {
      vi.mocked(React.useState).mockImplementationOnce((() => [
        state,
        (next: React.SetStateAction<IAssistantGradeSchemeCreate>) => {
          state = typeof next === 'function' ? next(state) : next;
        },
      ]) as typeof React.useState);
      vi.mocked(React.useEffect).mockImplementationOnce(() => {});
      vi.mocked(React.useMemo).mockImplementationOnce((factory) => factory());

      return useAssistantGradeSchemeForm({ initialValue });
    };

    let hook = Render();

    expect(hook.isValid).toBe(true);
    hook.handleGradeItemChange(catalog[0], true);
    expect(state.details).toHaveLength(2);
    hook.handlePercentageChange(catalog[0].idGradeItem, 60);
    hook = Render();
    expect(hook.totalPercentage).toBe(90);
    expect(hook.isValid).toBe(false);
    hook.handlePercentageChange(catalog[0].idGradeItem, 70);
    expect(Render().isValid).toBe(true);
    expect(state.assistantPercentage).toBe(20);
  });
});
