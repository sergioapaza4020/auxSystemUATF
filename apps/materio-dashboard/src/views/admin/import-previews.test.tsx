import type * as React from 'react';

import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { Alert, Button, TablePagination, TextField } from '@mui/material';

import { hookHarness, elements } from '@/test-utils/hook-harness';
import { EnrollmentImportPage } from './enrollments/import/EnrollmentImportPage';
import { EnrollmentImportReviewTable } from './enrollments/import/EnrollmentImportReviewTable';
import { CareerStudentImportPage } from './careers/import/CareerStudentImportPage';
import { CareerStudentImportReviewTable } from './careers/import/CareerStudentImportReviewTable';
import { getEnrollmentImportPreviewPage, previewEnrollmentImport, importEnrollments } from '@/api/enrollments.service';
import {
  getCareerStudentImportPreviewPage,
  previewCareerStudentImport,
  importCareerStudents,
} from '@/api/careers.service';
import type { IEnrollmentImportPreview } from '@/interfaces/enrollments/enrollment-import.interface';
import type { ICareerStudentImportPreview } from '@/interfaces/careers/career-student-import.interface';

const mocks = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock('react', async () => ({
  ...(await vi.importActual<typeof React>('react')),
  useState: vi.fn(),
  useEffect: vi.fn(),
  useRef: vi.fn(),
  useMemo: vi.fn(),
  useCallback: vi.fn(),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { roles: ['SUPERADMIN'], permissions: [] }, loading: false }),
}));
vi.mock('@/hooks/enrollments/useEnrollmentImportContext', () => ({
  useEnrollmentImportContext: () => ({
    enrollment: {
      idEnrollment: 8,
      role: 'ASSISTANT',
      isActive: true,
      user: { idUser: 9 },
      course: { idCourse: 10, name: 'Materia', isActive: true },
      semester: { idSemester: 20, isActive: true },
    },
    loading: false,
  }),
}));
vi.mock('@/utils/enrollmentImportAccess', () => ({ canImportEnrollmentStudents: () => true }));
vi.mock('@/hooks/careers/useCareerStudentImportContext', () => ({
  useCareerStudentImportContext: () => ({ career: { idCareer: 10, name: 'Carrera', isActive: true }, loading: false }),
}));
vi.mock('@/api/enrollments.service', () => ({
  getEnrollmentImportPreviewPage: vi.fn(),
  previewEnrollmentImport: vi.fn(),
  importEnrollments: vi.fn(),
  downloadEnrollmentImportTemplate: vi.fn(),
}));
vi.mock('@/api/careers.service', () => ({
  getCareerStudentImportPreviewPage: vi.fn(),
  previewCareerStudentImport: vi.fn(),
  importCareerStudents: vi.fn(),
  downloadCareerStudentImportTemplate: vi.fn(),
}));

const initial: IEnrollmentImportPreview = {
  operationId: 'operation-id',
  total: 60,
  valid: 60,
  invalid: 0,
  data: [
    {
      row: 2,
      studentId: 1,
      ru: '001',
      fullName: 'Ana',
      username: 'ana',
      email: 'ana@example.com',
      status: 'VALID',
      errors: [],
    },
  ],
  meta: { page: 1, limit: 25, total: 60, totalPages: 3 },
};

const career: ICareerStudentImportPreview = {
  ...initial,
  data: initial.data.map((row) => ({ ...row, currentCareer: null })),
};

const cleanups: (() => void)[] = [];

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.stubGlobal('window', { setTimeout, clearTimeout });
  vi.mocked(previewEnrollmentImport).mockResolvedValue(initial);
  vi.mocked(previewCareerStudentImport).mockResolvedValue(career);
  vi.mocked(importEnrollments).mockResolvedValue({ imported: 60, total: 60, courseId: 10, semesterId: 20 });
  vi.mocked(importCareerStudents).mockResolvedValue({ imported: 60, total: 60, careerId: 10 });
  vi.mocked(getEnrollmentImportPreviewPage).mockImplementation(async (_id, query) => ({
    ...initial,
    meta: { ...initial.meta, page: query.page, limit: query.limit },
  }));
  vi.mocked(getCareerStudentImportPreviewPage).mockImplementation(async (_careerId, _id, query) => ({
    ...career,
    meta: { ...career.meta, page: query.page, limit: query.limit },
  }));
});
afterEach(() => {
  cleanups.splice(0).forEach((clean) => clean());
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function mount<T>(render: () => T) {
  const h = hookHarness(render);

  cleanups.push(h.unmount);

  return h;
}

const find = <P,>(tree: React.ReactNode, type: unknown) => elements<P>(tree, type)[0].props;

describe.each(['enrollment', 'career'] as const)('%s remote review', (kind) => {
  const render = () =>
    kind === 'enrollment'
      ? EnrollmentImportReviewTable({ preview: initial, busy: false })
      : CareerStudentImportReviewTable({ preview: career, careerId: 10, busy: false });

  it('uses meta total, preserves page one from POST and queries subsequent pages/search/filter remotely', async () => {
    const h = mount(render);
    let tree = h.render();

    await vi.runAllTimersAsync();
    expect(getEnrollmentImportPreviewPage).not.toHaveBeenCalled();
    expect(getCareerStudentImportPreviewPage).not.toHaveBeenCalled();
    const pagination = find<React.ComponentProps<typeof TablePagination>>(tree, TablePagination);

    expect(pagination.count).toBe(60);
    expect(pagination.rowsPerPageOptions).toEqual([25, 50, 100]);
    pagination.onPageChange(null, 1);
    h.render();
    await vi.runAllTimersAsync();
    tree = h.render();
    expect(find<React.ComponentProps<typeof TablePagination>>(tree, TablePagination).page).toBe(1);
    const search = elements<React.ComponentProps<typeof TextField>>(tree, TextField)[0].props;

    search.onChange?.({ target: { value: 'Ana' } } as React.ChangeEvent<HTMLInputElement>);
    h.render();
    await vi.runAllTimersAsync();
    tree = h.render();
    const filter = elements<React.ComponentProps<typeof TextField>>(tree, TextField)[1].props;

    filter.onChange?.({ target: { value: 'invalid' } } as React.ChangeEvent<HTMLInputElement>);
    h.render();
    await vi.runAllTimersAsync();
    tree = h.render();

    const api =
      kind === 'enrollment' ? vi.mocked(getEnrollmentImportPreviewPage) : vi.mocked(getCareerStudentImportPreviewPage);

    expect(api.mock.calls.at(-1)).toEqual(
      kind === 'enrollment'
        ? ['operation-id', { page: 1, limit: 25, search: 'Ana', status: 'invalid' }, expect.any(AbortSignal)]
        : [10, 'operation-id', { page: 1, limit: 25, search: 'Ana', status: 'invalid' }, expect.any(AbortSignal)],
    );
    find<React.ComponentProps<typeof TablePagination>>(tree, TablePagination).onRowsPerPageChange?.({
      target: { value: '50' },
    } as React.ChangeEvent<HTMLInputElement>);
    h.render();
    await vi.runAllTimersAsync();
    expect(find<React.ComponentProps<typeof TablePagination>>(h.render(), TablePagination).page).toBe(0);
    expect(previewEnrollmentImport).not.toHaveBeenCalled();
    expect(previewCareerStudentImport).not.toHaveBeenCalled();
  });
  it('shows a request error and keeps global summary available', async () => {
    if (kind === 'enrollment') vi.mocked(getEnrollmentImportPreviewPage).mockRejectedValueOnce(new Error('Offline'));
    else vi.mocked(getCareerStudentImportPreviewPage).mockRejectedValueOnce(new Error('Offline'));
    const h = mount(render);

    find<React.ComponentProps<typeof TablePagination>>(h.render(), TablePagination).onPageChange(null, 1);
    h.render();
    await vi.runAllTimersAsync();
    expect(elements(h.render(), Alert)).toHaveLength(1);
    expect(initial.total).toBe(60);
  });
});
describe.each(['enrollment', 'career'] as const)('%s confirmation', (kind) => {
  it('uploads preview once, passes operation preview to the table and executes with ID rather than file/rows', async () => {
    const h = mount(() =>
      kind === 'enrollment' ? EnrollmentImportPage({ idEnrollment: 8 }) : CareerStudentImportPage({ careerId: 10 }),
    );

    let tree = h.render();

    const input = elements<{ type?: string; onChange: (event: { target: { files: File[]; value: string } }) => void }>(
      tree,
      'input',
    ).find((element) => element.props.type === 'file');

    const file = new File(['test'], 'students.xlsx');

    input?.props.onChange({ target: { files: [file], value: 'file' } });
    tree = h.render();

    const button = (label: string) =>
      elements<React.ComponentProps<typeof Button>>(h.render(), Button).find(
        (element) => element.props.children === label,
      )?.props;

    button('Revisar archivo')?.onClick?.({} as React.MouseEvent<HTMLButtonElement>);
    await vi.runAllTimersAsync();
    tree = h.render();

    const table =
      kind === 'enrollment'
        ? elements<{ preview: IEnrollmentImportPreview }>(tree, EnrollmentImportReviewTable)[0]
        : elements<{ preview: ICareerStudentImportPreview }>(tree, CareerStudentImportReviewTable)[0];

    expect(table.props.preview.operationId).toBe('operation-id');
    expect(table.props.preview.total).toBe(60);
    button(kind === 'enrollment' ? 'Confirmar matriculación' : 'Confirmar asignación')?.onClick?.(
      {} as React.MouseEvent<HTMLButtonElement>,
    );
    button(kind === 'enrollment' ? 'Confirmar matriculación' : 'Confirmar asignación')?.onClick?.(
      {} as React.MouseEvent<HTMLButtonElement>,
    );
    await vi.runAllTimersAsync();
    h.render();

    if (kind === 'enrollment') {
      expect(previewEnrollmentImport).toHaveBeenCalledOnce();
      expect(importEnrollments).toHaveBeenCalledWith('operation-id');
      expect(importEnrollments).toHaveBeenCalledOnce();
    } else {
      expect(previewCareerStudentImport).toHaveBeenCalledOnce();
      expect(importCareerStudents).toHaveBeenCalledWith('operation-id', 10);
      expect(importCareerStudents).toHaveBeenCalledOnce();
    }
  });
});
