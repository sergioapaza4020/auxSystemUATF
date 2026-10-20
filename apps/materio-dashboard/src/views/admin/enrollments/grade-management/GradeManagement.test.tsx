import * as React from 'react';

import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Button, ButtonBase, Dialog, TextField, ToggleButtonGroup } from '@mui/material';

import { GradeManagement } from './GradeManagement';
import { GradePlanTable } from './GradePlanTable';
import { GradeChangesBar } from './GradeChangesBar';
import { GradeViewToggle } from '../GradeViewToggle';
import { ActivityFormDialog } from '../ActivityFormDialog';
import { ActivityForm } from '../ActivityForm';
import { createActivity } from '@/api/activities.service';
import { PaginationTable } from '@/components/table';
import type { useGradeMatrix } from '@/hooks/grades/useGradeMatrix';

const mocks = vi.hoisted(() => ({ push: vi.fn(), success: vi.fn(), error: vi.fn(), grades: vi.fn(), canCreate: true }));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock('@/hooks/useSnackbar', () => ({ useSnackbar: () => ({ success: mocks.success, error: mocks.error }) }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { roles: ['SUPERADMIN'], permissions: [] } }) }));
vi.mock('@/hooks/grades/useGradeMatrix', () => ({ useGradeMatrix: mocks.grades }));
vi.mock('@/api/activities.service', () => ({ createActivity: vi.fn(), updateActivity: vi.fn() }));
vi.mock('@/utils/hasPermission', () => ({
  hasPermission: (_user: unknown, permission: string) => permission !== 'activity.create' || mocks.canCreate,
}));
vi.mock('react', async () => {
  const actual = await vi.importActual<typeof React>('react');

  return {
    ...actual,
    useState: vi.fn(actual.useState),
    useMemo: vi.fn(actual.useMemo),
    useCallback: vi.fn(actual.useCallback),
    useEffect: vi.fn(actual.useEffect),
    useRef: vi.fn(actual.useRef),
  };
});
const actual = await vi.importActual<typeof React>('react');

type GradeState = ReturnType<typeof useGradeMatrix>;

function state(extra: Partial<GradeState> = {}): GradeState {
  return {
    matrix: {
      enrollment: { idEnrollment: 1, idCourse: 7, code: 'SIS', name: 'Materia', group: 1, assistantName: 'Auxiliar' },
      scheme: { idGradeScheme: 2, assistantPercentage: 20 },
      criteria: [{ idGradeSchemeDetail: 3, name: 'Criterio dinámico', percentage: 100, activityCount: 1 }],
      detail: { idGradeSchemeDetail: 3, name: 'Criterio dinámico', percentage: 100 },
      activities: [
        { idActivity: 10, name: 'Entrega', dueDate: '2026-10-15', publicationDate: null, description: null },
      ],
      students: Array.from({ length: 30 }, (_, index) => ({
        idEnrollment: 100 + index,
        name: `Alumno${index}`,
        lastname: 'Apellido',
        ci: `CI${index}`,
        ru: `RU${index}`,
      })),
      grades: [],
    },
    query: { page: 1, limit: 25, search: '' },
    changeQuery: vi.fn(),
    loading: false,
    saving: false,
    error: null,
    originals: {},
    drafts: { '100:10': '85' },
    changes: [{ key: '100:10', enrollmentId: 100, activityId: 10, score: 85, error: null }],
    invalidCount: 0,
    edit: vi.fn(),
    save: vi.fn().mockResolvedValue(true),
    selectCriterion: vi.fn(),
    discard: vi.fn(),
    reload: vi.fn(),
    ...extra,
  };
}

function find(tree: React.ReactNode, type: unknown): React.ReactElement<Record<string, unknown>>[] {
  const matches: React.ReactElement<Record<string, unknown>>[] = [];

  React.Children.forEach(tree, (child) => {
    if (!React.isValidElement<Record<string, unknown>>(child)) return;
    if (child.type === type) matches.push(child);
    matches.push(...find(child.props.children as React.ReactNode, type));
    if (React.isValidElement(child.props.action)) matches.push(...find(child.props.action, type));
  });

  return matches;
}

function harness(grades: GradeState, renderComponent?: () => React.ReactElement) {
  const slots: unknown[] = [];
  const refs: { current: unknown }[] = [];

  mocks.grades.mockReturnValue(grades);

  return {
    render() {
      let index = 0;
      let refIndex = 0;

      vi.mocked(React.useState).mockImplementation(((initial: unknown) => {
        const slot = index++;

        if (!(slot in slots)) slots[slot] = initial;

        return [
          slots[slot],
          (value: unknown) => {
            slots[slot] = typeof value === 'function' ? value(slots[slot]) : value;
          },
        ];
      }) as typeof React.useState);
      vi.mocked(React.useMemo).mockImplementation((factory) => factory());
      vi.mocked(React.useCallback).mockImplementation((callback) => callback);
      vi.mocked(React.useEffect).mockImplementation(() => {});
      vi.mocked(React.useRef).mockImplementation(((initial: unknown) => {
        const slot = refIndex++;

        refs[slot] ??= { current: initial };

        return refs[slot];
      }) as typeof React.useRef);
      let tree: React.ReactElement;

      try {
        tree = renderComponent ? renderComponent() : GradeManagement({ idEnrollment: 1 });
      } finally {
        vi.mocked(React.useState).mockImplementation(actual.useState);
        vi.mocked(React.useMemo).mockImplementation(actual.useMemo);
        vi.mocked(React.useCallback).mockImplementation(actual.useCallback);
        vi.mocked(React.useEffect).mockImplementation(actual.useEffect);
        vi.mocked(React.useRef).mockImplementation(actual.useRef);
      }

      return tree;
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.canCreate = true;
});
describe('Mass grading screen interactions', () => {
  it.each([true, false])(
    'the existing dialog submits its current contract and closes only on success (%s)',
    async (success) => {
      const onCreate = vi.fn();
      const onClose = vi.fn();
      const onUpdate = vi.fn();

      if (success) onCreate.mockResolvedValue({ idActivity: 11 });
      else onCreate.mockRejectedValue(new Error('Ya existe una actividad con ese nombre.'));

      const h = harness(state(), () =>
        ActivityFormDialog({
          open: true,
          saving: false,
          activity: null,
          idGradeSchemeDetail: 3,
          creationNotice: 'Las actividades sin calificación se consideran con valor 0 en el cálculo del promedio.',
          onCreate,
          onClose,
          onUpdate,
        }),
      );

      (find(h.render(), ActivityForm)[0].props.onChange as (value: object) => void)({
        name: ' Nueva ',
        description: ' Detalle ',
        dueDate: '2026-10-20',
      });
      await (
        find(h.render(), Button).find((element) => element.props.children === 'Crear actividad')!.props
          .onClick as () => Promise<void>
      )();
      expect(onCreate).toHaveBeenCalledWith({
        gradeSchemeDetailId: 3,
        name: 'Nueva',
        description: 'Detalle',
        dueDate: '2026-10-20',
      });
      expect(onUpdate).not.toHaveBeenCalled();

      if (success) expect(onClose).toHaveBeenCalledOnce();
      else {
        expect(onClose).not.toHaveBeenCalled();
        expect(mocks.error).toHaveBeenCalledWith('Ya existe una actividad con ese nombre.');
        expect(
          find(h.render(), Button).find((element) => element.props.children === 'Crear actividad')!.props.disabled,
        ).toBe(false);
      }
    },
  );
  it('opens the existing form for the selected detail and creates through the existing service without losing context', async () => {
    const grades = state();
    const h = harness(grades);

    (find(h.render(), PaginationTable)[0].props.onPageChange as (event: null, page: number) => void)(null, 1);
    (find(h.render(), GradeViewToggle)[0].props.onChange as (value: string) => void)('raw');
    (
      find(h.render(), Button).find((element) => element.props.children === 'Agregar actividad')!.props
        .onClick as () => void
    )();
    const form = find(h.render(), ActivityFormDialog)[0];

    expect(form.props.idGradeSchemeDetail).toBe(3);
    expect(form.props.activity).toBeNull();
    expect(form.props.creationNotice).toContain('valor 0');
    vi.mocked(createActivity).mockResolvedValueOnce({
      idActivity: 11,
      isActive: true,
      name: 'Nueva',
      dueDate: '2026-10-10',
    });
    await (form.props.onCreate as (data: object) => Promise<unknown>)({
      gradeSchemeDetailId: 999,
      name: 'Nueva',
      dueDate: '2026-10-10',
    });
    expect(createActivity).toHaveBeenCalledWith(7, { gradeSchemeDetailId: 3, name: 'Nueva', dueDate: '2026-10-10' });
    expect(grades.reload).toHaveBeenCalledOnce();
    expect(grades.selectCriterion).toHaveBeenCalledWith(3);
    expect(mocks.success).toHaveBeenCalledWith('Actividad creada correctamente.');
    (form.props.onClose as () => void)();
    expect(find(h.render(), ActivityFormDialog)).toHaveLength(0);
    grades.matrix!.activities.unshift({
      idActivity: 11,
      name: 'Nueva',
      dueDate: '2026-10-10',
      publicationDate: null,
      description: null,
    });
    const table = find(h.render(), GradePlanTable)[0];

    expect((table.props.activities as { idActivity: number }[]).map((activity) => activity.idActivity)).toEqual([
      11, 10,
    ]);
    expect(grades.changeQuery).toHaveBeenCalledWith({ page: 2 });
    expect(table.props.firstRow).toBe((grades.query.page - 1) * grades.query.limit);
    expect(table.props.displayMode).toBe('raw');
    expect(table.props.drafts).toBe(grades.drafts);
    expect(grades.discard).not.toHaveBeenCalled();
  });
  it('retains form and grades after a failed creation', async () => {
    const grades = state();
    const h = harness(grades);

    (
      find(h.render(), Button).find((element) => element.props.children === 'Agregar actividad')!.props
        .onClick as () => void
    )();
    vi.mocked(createActivity).mockRejectedValueOnce(new Error('Nombre duplicado'));
    await expect(
      (find(h.render(), ActivityFormDialog)[0].props.onCreate as (data: object) => Promise<unknown>)({
        name: 'Nueva',
        dueDate: '2026-10-10',
      }),
    ).rejects.toThrow('Nombre duplicado');
    expect(find(h.render(), ActivityFormDialog)).toHaveLength(1);
    expect(find(h.render(), GradePlanTable)[0].props.drafts).toBe(grades.drafts);
    expect(grades.reload).not.toHaveBeenCalled();
    expect(mocks.success).not.toHaveBeenCalled();
  });
  it('offers the same form for an empty criterion and hides creation without permission or compatible criterion', () => {
    const grades = state();

    grades.matrix!.activities = [];
    const h = harness(grades);

    (
      find(h.render(), Button).find((element) => element.props.children === 'Crear primera actividad')!.props
        .onClick as () => void
    )();
    expect(find(h.render(), ActivityFormDialog)[0].props.idGradeSchemeDetail).toBe(3);
    mocks.canCreate = false;
    expect(find(h.render(), ActivityFormDialog)).toHaveLength(0);
    expect(
      find(h.render(), Button).some(
        (element) =>
          element.props.children === 'Agregar actividad' || element.props.children === 'Crear primera actividad',
      ),
    ).toBe(false);
    mocks.canCreate = true;
    grades.matrix!.detail = null;
    grades.matrix!.criteria = [];
    expect(
      find(h.render(), Button).some(
        (element) =>
          element.props.children === 'Agregar actividad' || element.props.children === 'Crear primera actividad',
      ),
    ).toBe(false);
  });
  it('defaults to the summary weighted mode and only changes result presentation when toggled', () => {
    const grades = state();
    const h = harness(grades);
    const first = find(h.render(), GradePlanTable)[0];

    expect(first.props.displayMode).toBe('weighted');
    expect(first.props.assistantPercentage).toBe(20);
    (find(h.render(), GradeViewToggle)[0].props.onChange as (value: string) => void)('raw');
    const after = find(h.render(), GradePlanTable)[0];

    expect(after.props.displayMode).toBe('raw');
    expect(after.props.drafts).toBe(first.props.drafts);
    expect(grades.edit).not.toHaveBeenCalled();
    expect(grades.save).not.toHaveBeenCalled();
    expect(grades.selectCriterion).not.toHaveBeenCalled();
  });
  it('retains the same draft state across criteria, both views, search and pagination', () => {
    const grades = state();
    const h = harness(grades);
    let tree = h.render();

    (find(tree, PaginationTable)[0].props.onPageChange as (event: null, page: number) => void)(null, 1);
    tree = h.render();
    expect(grades.changeQuery).toHaveBeenCalledWith({ page: 2 });
    (find(tree, TextField)[0].props.onChange as (event: { target: { value: string } }) => void)({
      target: { value: 'RU0' },
    });
    tree = h.render();
    expect(grades.changeQuery).toHaveBeenCalledWith({ search: 'RU0' });
    (find(tree, ToggleButtonGroup)[0].props.onChange as (event: null, value: string) => void)(null, 'activity');
    tree = h.render();
    expect(find(tree, TextField).some((element) => element.props.label === 'Actividad')).toBe(true);
    (find(tree, ButtonBase)[0].props.onClick as () => void)();
    expect(grades.selectCriterion).toHaveBeenCalledWith(3);
    expect(grades.discard).not.toHaveBeenCalled();
    expect(find(h.render(), GradePlanTable)[0].props.drafts).toBe(grades.drafts);
  });
  it('confirms leaving and discarding only when changes exist', () => {
    const grades = state();
    const h = harness(grades);
    const back = find(h.render(), Button).find((element) => element.props.children === 'Volver a la materia')!;

    (back.props.onClick as () => void)();
    expect(mocks.push).not.toHaveBeenCalled();
    let tree = h.render();

    expect(find(tree, Dialog)[0].props.open).toBe(true);
    const cancel = find(tree, Button).find((element) => element.props.children === 'Cancelar')!;

    (cancel.props.onClick as () => void)();
    expect(find(h.render(), Dialog)[0].props.open).toBe(false);
    (find(h.render(), GradeChangesBar)[0].props.onDiscard as () => void)();
    tree = h.render();
    (find(tree, Button).find((element) => element.props.children === 'Descartar')!.props.onClick as () => void)();
    expect(grades.discard).toHaveBeenCalledOnce();
    const clean = harness(state({ changes: [], drafts: {} }));

    (
      find(clean.render(), Button).find((element) => element.props.children === 'Volver a la materia')!.props
        .onClick as () => void
    )();
    expect(mocks.push).toHaveBeenCalledWith('/dashboard/enrollments/1');
  });
  it.each(['scheme', 'criteria', 'activities', 'students', 'loading', 'error'] as const)(
    'explains the %s empty/loading/error state',
    (kind) => {
      const grades = state({ changes: [], drafts: {} });

      if (kind === 'scheme') grades.matrix!.scheme = null;

      if (kind === 'criteria') {
        grades.matrix!.detail = null;
        grades.matrix!.criteria = [];
      }

      if (kind === 'activities') grades.matrix!.activities = [];
      if (kind === 'students') grades.matrix!.students = [];
      if (kind === 'loading') grades.loading = true;
      if (kind === 'error') grades.error = 'No se pudo cargar';
      const html = renderToStaticMarkup(harness(grades).render());

      const messages = {
        scheme: 'Todavía no existe un esquema',
        criteria: 'No existen criterios con actividades',
        activities: 'No hay actividades registradas',
        students: 'No hay estudiantes matriculados',
        loading: 'Cargando planilla',
        error: 'No se pudo cargar',
      };

      expect(html).toContain(messages[kind]);
    },
  );
});
