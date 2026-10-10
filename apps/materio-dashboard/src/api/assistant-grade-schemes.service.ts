import { instance } from './config/config';

import type {
  IAssistantGradeScheme,
  IAssistantGradeSchemeDetail,
  IAssistantGradeSchemeCreate,
  IAssistantGradeSchemeUpdate,
} from '@/interfaces/grade-schemes/assistant-grade-scheme.interface';

type SchemeResponse = Omit<IAssistantGradeScheme, 'assistantPercentage' | 'details'> & {
  assistantPercentage: number | string;
  details: (Omit<IAssistantGradeSchemeDetail, 'permissionWeight' | 'percentage'> & {
    permissionWeight?: number | string;
    percentage: number | string;
  })[];
};

function responseNumber(value: number | string, maximum: number, field: string): number {
  const numeric =
    (typeof value !== 'number' && typeof value !== 'string') || (typeof value === 'string' && value.trim() === '')
      ? Number.NaN
      : Number(value);

  if (!Number.isFinite(numeric) || numeric < 0 || numeric > maximum)
    throw new Error(`La configuración contiene un valor inválido en ${field}.`);

  return numeric;
}

function normalizeScheme(scheme: SchemeResponse): IAssistantGradeScheme {
  return {
    ...scheme,
    assistantPercentage: responseNumber(scheme.assistantPercentage, 100, 'porcentaje del auxiliar'),
    details: scheme.details.map((detail) => ({
      ...detail,
      percentage: responseNumber(detail.percentage, 100, 'porcentaje del criterio'),
      permissionWeight:
        detail.permissionWeight == null ? undefined : responseNumber(detail.permissionWeight, 1, 'valor del permiso'),
    })),
  };
}

export const getMyAssistantGradeScheme = async (
  idCourse: number,
  idEnrollment?: number,
): Promise<IAssistantGradeScheme | null> => {
  const response = await instance.get<{ data: SchemeResponse | null }>(`/assistant-grade-schemes/course/${idCourse}`, {
    params: idEnrollment ? { enrollmentId: idEnrollment } : undefined,
  });

  return response.data.data === null ? null : normalizeScheme(response.data.data);
};

export const createAssistantGradeScheme = async (
  idCourse: number,
  data: IAssistantGradeSchemeCreate,
  idEnrollment?: number,
): Promise<IAssistantGradeScheme> => {
  const response = await instance.post<{ data: SchemeResponse }>(`/assistant-grade-schemes/course/${idCourse}`, data, {
    params: idEnrollment ? { enrollmentId: idEnrollment } : undefined,
  });

  return normalizeScheme(response.data.data);
};

export const updateAssistantGradeScheme = async (
  idAssistantGradeScheme: number,
  data: IAssistantGradeSchemeUpdate,
): Promise<IAssistantGradeScheme> => {
  const response = await instance.put<{ data: SchemeResponse }>(
    `/assistant-grade-schemes/${idAssistantGradeScheme}`,
    data,
  );

  return normalizeScheme(response.data.data);
};

export const deleteAssistantGradeScheme = async (id: number): Promise<void> => {
  await instance.delete(`/assistant-grade-schemes/${id}`);
};

export const reactivateAssistantGradeScheme = async (id: number): Promise<void> => {
  await instance.patch(`/assistant-grade-schemes/reactivate/${id}`);
};
