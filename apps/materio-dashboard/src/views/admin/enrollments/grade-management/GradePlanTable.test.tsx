import * as React from 'react';

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { TextField } from '@mui/material';
import { ThemeProvider, createTheme } from '@mui/material/styles';

import { GradePlanTable, type GradePlanTableProps } from './GradePlanTable';

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof React>('react');

  return { ...actual, useRef: vi.fn(actual.useRef), useEffect: vi.fn(actual.useEffect) };
});
const actualReact = await vi.importActual<typeof React>('react');

// MUI resolves a separate React type tree in this workspace; the runtime provider is the same.
const TestThemeProvider = ThemeProvider as unknown as React.ComponentType<{
  theme: ReturnType<typeof createTheme>;
  children: React.ReactNode;
}>;

function view(extra: Partial<GradePlanTableProps> = {}) {
  const props: GradePlanTableProps = {
    students: [{ idEnrollment: 100, name: 'Ana', lastname: 'Flores', ci: 'CI-1', ru: 'RU-1' }],
    activities: [
      { idActivity: 11, name: 'Entrega B', dueDate: '2026-10-22', publicationDate: null, description: null },
      { idActivity: 10, name: 'Entrega A', dueDate: '2026-10-15', publicationDate: null, description: null },
    ],
    resultActivityIds: [11, 10],
    originals: { '100:11': null, '100:10': 0 },
    drafts: {},
    firstRow: 25,
    disabled: false,
    pendingFocus: null,
    onFocusHandled: vi.fn(),
    onEdit: vi.fn(),
    onMove: vi.fn(),
    ...extra,
  };

  const effects: React.EffectCallback[] = [];

  vi.mocked(React.useRef).mockImplementation(((value: unknown) => ({ current: value })) as typeof React.useRef);
  vi.mocked(React.useEffect).mockImplementation((effect) => {
    effects.push(effect);
  });
  let tree: React.ReactElement;

  try {
    tree = GradePlanTable(props);
  } finally {
    vi.mocked(React.useRef).mockImplementation(actualReact.useRef);
    vi.mocked(React.useEffect).mockImplementation(actualReact.useEffect);
  }

  const inputs: React.ReactElement<React.ComponentProps<typeof TextField>>[] = [];

  const walk = (nodes: React.ReactNode) =>
    React.Children.forEach(nodes, (child) => {
      if (!React.isValidElement<{ children?: React.ReactNode }>(child)) return;
      if (child.type === TextField) inputs.push(child as React.ReactElement<React.ComponentProps<typeof TextField>>);
      walk(child.props.children);
    });

  walk(tree);

  return { props, tree, inputs, effects };
}

describe('Editable academic table', () => {
  it.each([
    { assistantPercentage: 20, contribution: 6, maximum: 12 },
    { assistantPercentage: 100, contribution: 30, maximum: 60 },
  ])(
    'changes only the result with an assistant block of $assistantPercentage%',
    ({ assistantPercentage, contribution, maximum }) => {
      const activities = [10, 11, 12].map((idActivity) => ({
        idActivity,
        name: `Entrega ${idActivity}`,
        dueDate: '2026-10-15',
        publicationDate: null,
        description: null,
      }));

      const base = {
        activities,
        resultActivityIds: [10, 11, 12],
        originals: { '100:10': 80, '100:11': 70, '100:12': null },
        percentage: 60,
        assistantPercentage,
      };

      const weighted = view({ ...base, displayMode: 'weighted' });
      const raw = view({ ...base, displayMode: 'raw' });

      expect(renderToStaticMarkup(weighted.tree)).toContain(`Resultado ${contribution.toFixed(1)} sobre ${maximum}`);
      expect(renderToStaticMarkup(raw.tree)).toContain('Resultado 50.0 sobre 100');
      expect(weighted.inputs.map((input) => input.props.value)).toEqual(['80', '70', '']);
      expect(raw.inputs.map((input) => input.props.value)).toEqual(['80', '70', '']);
      expect(weighted.props.onEdit).not.toHaveBeenCalled();
      expect(raw.props.onEdit).not.toHaveBeenCalled();
    },
  );
  it.each(['light', 'dark'] as const)(
    'renders dynamic headers and identity with horizontal scroll in %s theme',
    (mode) => {
      const { tree, inputs } = view();

      const html = renderToStaticMarkup(
        <TestThemeProvider theme={createTheme({ palette: { mode } })}>{tree}</TestThemeProvider>,
      );

      for (const text of ['Ana Flores', 'CI-1', 'RU-1', 'Entrega A', 'Entrega B', '22 oct 2026', 'Resultado'])
        expect(html).toContain(text);
      expect(html.indexOf('Entrega B')).toBeLessThan(html.indexOf('Entrega A'));
      expect(html).toContain('overflow-x:auto');
      expect(html).toContain('position:sticky');
      expect(inputs[0].props.value).toBe('');
      expect(inputs[1].props.value).toBe('0');
      expect(inputs[0].props.inputProps?.['aria-label']).toContain('Ana Flores en Entrega B');
    },
  );
  it('edits locally, navigates vertically and leaves Tab / Shift+Tab to native accessibility', () => {
    const { props, inputs } = view();

    inputs[0].props.onChange?.({ target: { value: '85' } } as React.ChangeEvent<HTMLInputElement>);
    expect(props.onEdit).toHaveBeenCalledWith('100:11', '85');

    for (const [key, direction] of [
      ['Enter', 1],
      ['ArrowDown', 1],
      ['ArrowUp', -1],
    ] as const) {
      const preventDefault = vi.fn();

      inputs[0].props.onKeyDown?.({
        key,
        nativeEvent: { isComposing: false },
        preventDefault,
      } as unknown as React.KeyboardEvent<HTMLDivElement>);
      expect(props.onMove).toHaveBeenLastCalledWith(100, 11, direction);
      expect(preventDefault).toHaveBeenCalledOnce();
    }

    for (const shiftKey of [false, true]) {
      const preventDefault = vi.fn();

      inputs[0].props.onKeyDown?.({
        key: 'Tab',
        shiftKey,
        preventDefault,
      } as unknown as React.KeyboardEvent<HTMLDivElement>);
      expect(preventDefault).not.toHaveBeenCalled();
    }
  });
  it('marks errors accessibly and focuses the next stable cell after paging', () => {
    const { inputs, effects, props } = view({ drafts: { '100:11': '101' }, pendingFocus: '100:10' });

    expect(inputs[0].props.error).toBe(true);
    expect(inputs[0].props.inputProps?.['aria-invalid']).toBe(true);
    expect(inputs[0].props.inputProps?.['aria-label']).toContain('modificada sin guardar');
    const input = { focus: vi.fn(), select: vi.fn() };

    (inputs[1].props.inputRef as (input: unknown) => void)(input);
    effects.forEach((effect) => effect());
    expect(input.focus).toHaveBeenCalledOnce();
    expect(input.select).toHaveBeenCalledOnce();
    expect(props.onFocusHandled).toHaveBeenCalledOnce();
  });
});
