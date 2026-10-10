import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getMyAssistantGradeScheme, updateAssistantGradeScheme } from './assistant-grade-schemes.service';

const mocks = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }));

vi.mock('./config/config', () => ({ instance: mocks }));

const wire = {
  idGradeScheme: 8,
  assistantPercentage: '20.00',
  name: 'Esquema',
  isActive: true,
  details: [
    {
      idGradeSchemeDetail: 1,
      percentage: '100',
      permissionWeight: '0.505',
      order: 1,
      gradeItem: { idGradeItem: 5, name: 'Asistencias', isActive: true },
      activities: [],
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.get.mockResolvedValue({ data: { status: true, statusCode: 200, data: wire } });
  mocks.put.mockResolvedValue({ data: { status: true, statusCode: 200, data: wire } });
});
describe('Assistant scheme response numeric contract', () => {
  it('unwraps the interceptor response and converts PostgreSQL numeric strings before PUT', async () => {
    const scheme = await getMyAssistantGradeScheme(3, 20);

    expect(scheme?.assistantPercentage).toBe(20);
    expect(scheme?.details[0].permissionWeight).toBe(0.505);
    if (!scheme) throw new Error('Expected scheme');

    const payload = {
      assistantPercentage: scheme.assistantPercentage,
      details: scheme.details.map((detail) => ({
        percentage: detail.percentage,
        permissionWeight: detail.permissionWeight,
        order: detail.order,
        gradeItem: { idGradeItem: detail.gradeItem.idGradeItem },
      })),
    };

    const updated = await updateAssistantGradeScheme(scheme.idGradeScheme, payload);

    expect(mocks.get).toHaveBeenCalledWith('/assistant-grade-schemes/course/3', { params: { enrollmentId: 20 } });
    expect(mocks.put).toHaveBeenCalledWith('/assistant-grade-schemes/8', {
      assistantPercentage: 20,
      details: [{ percentage: 100, permissionWeight: 0.505, order: 1, gradeItem: { idGradeItem: 5 } }],
    });
    expect(updated.details[0].permissionWeight).toBe(0.505);
  });
  it.each(['', 'Infinity', 'NaN', '-1', '101', null, false])(
    'rejects malformed response numeric value %s',
    async (assistantPercentage) => {
      mocks.get.mockResolvedValueOnce({ data: { data: { ...wire, assistantPercentage } } });
      await expect(getMyAssistantGradeScheme(3, 20)).rejects.toThrow('porcentaje del auxiliar');
    },
  );
  it('preserves a missing active scheme', async () => {
    mocks.get.mockResolvedValueOnce({ data: { data: null } });
    expect(await getMyAssistantGradeScheme(3, 20)).toBeNull();
  });
});
