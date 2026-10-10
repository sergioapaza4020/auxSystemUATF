import * as React from 'react';

import { CanceledError } from 'axios';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { getGradeMatrix, saveActivityGrades } from '@/api/grade-matrix.service';
import { useGradeMatrix } from './useGradeMatrix';
import { studentCriterionResult } from './grade-matrix-state';
import type { IGradeMatrix } from '@/interfaces/grades/grade-matrix.interface';

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof React>('react');

  return { ...actual, useState: vi.fn(), useEffect: vi.fn(), useRef: vi.fn(), useMemo: vi.fn(), useCallback: vi.fn() };
});
vi.mock('@/api/grade-matrix.service', () => ({ getGradeMatrix: vi.fn(), saveActivityGrades: vi.fn() }));
afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

const matrix: IGradeMatrix = {
  enrollment: { idEnrollment: 1, idCourse: 7, code: 'SIS', name: 'Materia', group: 1, assistantName: 'Auxiliar' },
  scheme: { idGradeScheme: 2, assistantPercentage: 20 },
  criteria: [{ idGradeSchemeDetail: 3, name: 'Evaluación configurable', percentage: 100, activityCount: 1 }],
  detail: { idGradeSchemeDetail: 3, name: 'Evaluación configurable', percentage: 100 },
  activities: [{ idActivity: 10, name: 'Entrega', dueDate: '2026-10-15', publicationDate: null, description: null }],
  students: [{ idEnrollment: 100, name: 'Ana', lastname: 'Flores', ci: '1', ru: '2' }],
  grades: [],
};

function harness(idUser?: number) {
  const state: unknown[] = [];
  const refs: { current: unknown }[] = [];
  const dependencies: React.DependencyList[] = [];
  const cleanups: (void | (() => void))[] = [];
  const effects: (() => void)[] = [];

  function useRender() {
    let stateIndex = 0,
      refIndex = 0,
      effectIndex = 0;

    vi.mocked(React.useState).mockImplementation(((initial?: unknown) => {
      const index = stateIndex++;

      if (!(index in state)) state[index] = initial;

      return [
        state[index],
        (value: unknown) => {
          state[index] = typeof value === 'function' ? value(state[index]) : value;
        },
      ];
    }) as typeof React.useState);
    vi.mocked(React.useRef).mockImplementation(((value: unknown) => {
      const index = refIndex++;

      refs[index] ??= { current: value };

      return refs[index];
    }) as typeof React.useRef);
    vi.mocked(React.useMemo).mockImplementation((factory) => factory());
    vi.mocked(React.useCallback).mockImplementation((callback) => callback);
    vi.mocked(React.useEffect).mockImplementation((effect, deps = []) => {
      const index = effectIndex++;

      if (!dependencies[index] || deps.some((value, key) => !Object.is(value, dependencies[index][key]))) {
        dependencies[index] = deps;
        effects.push(() => {
          cleanups[index]?.();
          cleanups[index] = effect();
        });
      }
    });
    const result = useGradeMatrix(1, true, idUser);

    effects.splice(0).forEach((effect) => effect());

    return result;
  }

  return { render: useRender, unmount: () => cleanups.forEach((cleanup) => cleanup?.()) };
}

const settle = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

describe('Mass grading lifecycle', () => {
  it('merges a newly created activity on reload without losing dirty scores and recalculates using every column', async () => {
    vi.mocked(getGradeMatrix).mockResolvedValueOnce({
      ...matrix,
      grades: [{ idGrade: 1, enrollmentId: 100, activityId: 10, score: 80 }],
    });
    const h = harness();

    h.render();
    await settle();
    h.render().edit('100:10', '90');

    const refreshed = {
      ...matrix,
      activities: [
        { idActivity: 11, name: 'Nueva anterior', dueDate: '2026-10-10', publicationDate: null, description: null },
        ...matrix.activities,
      ],
    };

    vi.mocked(getGradeMatrix).mockResolvedValueOnce(refreshed);
    h.render().reload();
    h.render();
    await settle();
    expect(h.render().matrix?.activities.map((activity) => activity.idActivity)).toEqual([11, 10]);
    expect(h.render().drafts['100:10']).toBe('90');
    expect(h.render().originals['100:10']).toBe(80);
    expect(h.render().originals['100:11']).toBeNull();
    expect(h.render().changes).toHaveLength(1);
    expect(studentCriterionResult(100, [11, 10], h.render().originals, h.render().drafts)).toBe(45);
  });
  it('ignores an intentional unmount cancellation and supports the StrictMode remount', async () => {
    vi.mocked(getGradeMatrix).mockImplementationOnce(
      (_id, _detail, signal) =>
        new Promise((_resolve, reject) => {
          signal?.addEventListener('abort', () => reject(new CanceledError('canceled')));
        }),
    );
    const mounted = harness();

    mounted.render();
    mounted.unmount();
    await settle();
    expect(mounted.render().error).toBeNull();
    vi.mocked(getGradeMatrix).mockResolvedValue(matrix);
    const remount = harness();

    remount.render();
    await settle();
    expect(remount.render().matrix).toBe(matrix);
    expect(remount.render().error).toBeNull();
  });
  it('keeps valid data and drafts when a replacement load fails with a real error', async () => {
    vi.mocked(getGradeMatrix).mockResolvedValue(matrix);
    const h = harness();

    h.render();
    await settle();
    h.render().edit('100:10', '85');
    vi.mocked(getGradeMatrix).mockRejectedValueOnce(new Error('El servidor no está disponible.'));
    h.render().selectCriterion(99);
    h.render();
    await settle();
    expect(h.render().error).toBe('El servidor no está disponible.');
    expect(h.render().matrix).toBe(matrix);
    expect(h.render().drafts['100:10']).toBe('85');
  });
  it('restores the same user/materia draft after browser navigation and removes it after discarding', async () => {
    const values = new Map([
      ['uatf:grade-drafts:4:1', JSON.stringify({ originals: { '100:10': null }, drafts: { '100:10': '85' } })],
    ]);

    vi.stubGlobal('window', {
      sessionStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key),
      },
    });
    vi.mocked(getGradeMatrix).mockResolvedValue(matrix);
    const h = harness(4);

    h.render();
    await settle();
    expect(h.render().drafts['100:10']).toBe('85');
    expect(h.render().changes).toHaveLength(1);
    h.render().discard();
    h.render();
    expect(values.has('uatf:grade-drafts:4:1')).toBe(false);
  });
  it('loads once and makes no HTTP calls while typing, preserving drafts across criteria', async () => {
    vi.mocked(getGradeMatrix).mockResolvedValue(matrix);
    const h = harness();

    h.render();
    await settle();
    h.render().edit('100:10', '8');
    h.render().edit('100:10', '85');
    expect(h.render().changes).toHaveLength(1);
    expect(getGradeMatrix).toHaveBeenCalledTimes(1);
    expect(saveActivityGrades).not.toHaveBeenCalled();
    h.render().selectCriterion(9);
    h.render();
    await settle();
    expect(h.render().drafts['100:10']).toBe('85');
    expect(getGradeMatrix).toHaveBeenCalledTimes(2);
  });
  it('blocks double submit, adopts confirmed precision and clears drafts only after success', async () => {
    vi.mocked(getGradeMatrix).mockResolvedValue(matrix);
    let resolve!: (value: IGradeMatrix['grades']) => void;

    vi.mocked(saveActivityGrades).mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const h = harness();

    h.render();
    await settle();
    h.render().edit('100:10', '85.555');
    const saving = h.render().save();

    expect(h.render().saving).toBe(true);
    expect(h.render().drafts['100:10']).toBe('85.555');
    expect(await h.render().save()).toBe(false);
    h.render().edit('100:10', '1');
    resolve([{ idGrade: 2, enrollmentId: 100, activityId: 10, score: 85.56 }]);
    expect(await saving).toBe(true);
    expect(saveActivityGrades).toHaveBeenCalledTimes(1);
    expect(h.render().originals['100:10']).toBe(85.56);
    expect(h.render().matrix?.grades).toEqual([{ idGrade: 2, enrollmentId: 100, activityId: 10, score: 85.56 }]);
    expect(h.render().changes).toEqual([]);
    expect(h.render().saving).toBe(false);
  });
  it('retains values after network failure and rejects an unrelated confirmation', async () => {
    vi.mocked(getGradeMatrix).mockResolvedValue(matrix);
    vi.mocked(saveActivityGrades).mockRejectedValueOnce(new Error('Sin conexión'));
    const h = harness();

    h.render();
    await settle();
    h.render().edit('100:10', '0');
    await expect(h.render().save()).rejects.toThrow('Sin conexión');
    expect(h.render().drafts['100:10']).toBe('0');
    vi.mocked(saveActivityGrades).mockResolvedValue([{ idGrade: 2, enrollmentId: 999, activityId: 10, score: 0 }]);
    await expect(h.render().save()).rejects.toThrow('incompleta');
    expect(h.render().changes).toHaveLength(1);
    h.render().discard();
    expect(h.render().changes).toEqual([]);
  });
  it('does not submit untouched or invalid cells', async () => {
    vi.mocked(getGradeMatrix).mockResolvedValue(matrix);
    const h = harness();

    h.render();
    await settle();
    expect(await h.render().save()).toBe(false);
    h.render().edit('100:10', '101');
    await expect(h.render().save()).rejects.toThrow();
    expect(saveActivityGrades).not.toHaveBeenCalled();
  });
});
