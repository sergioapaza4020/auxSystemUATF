import type * as React from 'react';

import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Accordion, Checkbox, FormControlLabel, TextField, ToggleButtonGroup } from '@mui/material';

import type { IPermission } from '@/interfaces/permissions/permission.interface';
import { elements, hookHarness } from '@/test-utils/hook-harness';
import { GroupedPermissionSelector } from './GroupedPermissionSelector';
import { groupPermissions, permissionLabel } from './permission-selector';

vi.mock('react', async () => ({
  ...(await vi.importActual<typeof React>('react')),
  useId: () => 'permissions-test',
  useState: vi.fn(),
  useEffect: vi.fn(),
  useRef: vi.fn(),
  useMemo: vi.fn(),
  useCallback: vi.fn(),
}));

const permissions: IPermission[] = [
  { idPermission: 1, name: 'user.get-all', description: 'Ver usuarios', isActive: true },
  { idPermission: 2, name: 'user.create', description: 'Crear usuarios', isActive: true },
  { idPermission: 3, name: 'attendance.session.create', description: 'Crear sesión de asistencia', isActive: true },
  { idPermission: 4, name: 'attendance.save', description: 'Guardar asistencia', isActive: true },
  { idPermission: 5, name: 'custom-resource.export', description: 'Exportar datos', isActive: true },
];

type Props = React.ComponentProps<typeof GroupedPermissionSelector>;
const event = {} as React.ChangeEvent<HTMLInputElement>;

function fixture(initial: string[] = []) {
  const props: Props = {
    permissions,
    selectedPermissionNames: initial,
    onChange: vi.fn((names) => {
      props.selectedPermissionNames = names;
    }),
  };

  const h = hookHarness(() => GroupedPermissionSelector(props));

  const group = (label: string) =>
    elements<React.ComponentProps<typeof Checkbox>>(h.render(), Checkbox).find(
      (item) => item.props.inputProps?.['aria-label'] === `Seleccionar todos los permisos de ${label}`,
    )!.props;

  const items = () =>
    elements<React.ComponentProps<typeof FormControlLabel>>(h.render(), FormControlLabel).map((item) => item.props);

  const item = (name: string) => {
    const fields = items();

    return fields.find((field) => renderToStaticMarkup(field.label).includes(name))!.control as React.ReactElement<
      React.ComponentProps<typeof Checkbox>
    >;
  };

  const search = (value: string) =>
    elements<React.ComponentProps<typeof TextField>>(h.render(), TextField)[0].props.onChange?.({
      target: { value },
    } as React.ChangeEvent<HTMLInputElement>);

  const filter = (value: string) =>
    elements<React.ComponentProps<typeof ToggleButtonGroup>>(h.render(), ToggleButtonGroup)[0].props.onChange?.(
      {} as React.MouseEvent<HTMLElement>,
      value,
    );

  return { ...h, props, group, items, item, search, filter };
}

beforeEach(() => vi.clearAllMocks());
describe('Grouped permission selection', () => {
  it('renders readable groups, global/group counts, descriptions and technical codes', () => {
    const h = fixture(['user.get-all']);
    const html = renderToStaticMarkup(h.render());

    expect(html).toContain('Usuarios');
    expect(html).toContain('Asistencia');
    expect(html).toContain('custom resource');
    expect(html).toContain('1 asignados');
    expect(html).toContain('1 / 2');
    expect(html).toContain('Ver usuarios');
    expect(html).toContain('user.get-all');
    expect(h.group('Usuarios')).toMatchObject({ checked: false, indeterminate: true });
    h.unmount();
  });
  it('toggles individuals and complete groups without mutating the initial selection', () => {
    const initial = ['custom-resource.export'];
    const h = fixture(initial);

    expect(h.group('Usuarios')).toMatchObject({ checked: false, indeterminate: false });
    h.item('user.get-all').props.onChange?.(event, true);
    expect(h.group('Usuarios').indeterminate).toBe(true);
    h.group('Usuarios').onChange?.(event, true);
    expect(h.group('Usuarios')).toMatchObject({ checked: true, indeterminate: false });
    expect(new Set(h.props.selectedPermissionNames)).toEqual(
      new Set(['custom-resource.export', 'user.get-all', 'user.create']),
    );
    h.item('user.get-all').props.onChange?.(event, false);
    expect(h.props.selectedPermissionNames).not.toContain('user.get-all');
    h.group('Usuarios').onChange?.(event, false);
    expect(h.props.selectedPermissionNames).toEqual(initial);
    expect(initial).toEqual(['custom-resource.export']);
    h.unmount();
  });
  it('searches labels, descriptions and codes without dropping hidden selections; group actions include hidden matches', () => {
    const h = fixture(['user.get-all', 'legacy.inactive']);

    h.search('asistencia');
    expect(h.items()).toHaveLength(2);
    expect(elements<React.ComponentProps<typeof Accordion>>(h.render(), Accordion)[0].props.expanded).toBe(true);
    h.search('attendance.session');
    expect(h.items()).toHaveLength(1);
    h.group('Asistencia').onChange?.(event, true);
    expect(h.props.selectedPermissionNames).toEqual([
      'user.get-all',
      'legacy.inactive',
      'attendance.session.create',
      'attendance.save',
    ]);
    h.search('');
    expect(h.items()).toHaveLength(5);
    expect(h.item('user.get-all').props.checked).toBe(true);
    expect(h.props.selectedPermissionNames).toContain('legacy.inactive');
    h.unmount();
  });
  it('filters selected/unselected and computes parent states from the complete group', () => {
    const h = fixture(['user.get-all']);

    h.filter('selected');
    expect(h.items()).toHaveLength(1);
    expect(h.group('Usuarios').indeterminate).toBe(true);
    h.filter('unselected');
    expect(h.items()).toHaveLength(4);
    h.filter('all');
    expect(h.items()).toHaveLength(5);
    h.search('no results');
    expect(h.items()).toHaveLength(0);
    expect(renderToStaticMarkup(h.render())).toContain('No hay permisos que coincidan');
    expect(h.props.selectedPermissionNames).toEqual(['user.get-all']);
    h.unmount();
  });
  it('supports keyboard accordion toggling during search and disabled controls', () => {
    const h = fixture();

    h.search('usuarios');
    let accordion = elements<React.ComponentProps<typeof Accordion>>(h.render(), Accordion)[0].props;

    accordion.onChange?.({} as React.SyntheticEvent, false);
    accordion = elements<React.ComponentProps<typeof Accordion>>(h.render(), Accordion)[0].props;
    expect(accordion.expanded).toBe(false);
    h.props.disabled = true;
    expect(h.group('Usuarios').disabled).toBe(true);
    expect(h.item('user.create').props.disabled).toBe(true);
    h.unmount();
  });
  it('sorts independently of API order, supports new prefixes and readable missing descriptions', () => {
    expect(groupPermissions(permissions)).toEqual(groupPermissions([...permissions].reverse()));
    expect(permissionLabel({ ...permissions[0], description: '', name: 'user.update' })).toBe('Actualizar · Usuarios');
    expect(groupPermissions([{ ...permissions[0], name: 'legacy' }])[0].label).toBe('Otros');
  });
});
