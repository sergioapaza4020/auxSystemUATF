'use client';

import { useEffect, useMemo, useState } from 'react';

import type { IGradeItem } from '@/interfaces/grade-items/grade-item.interface';

import type {
  IAssistantGradeSchemeCreate,
  IAssistantGradeSchemeDetailCreate,
} from '@/interfaces/grade-schemes/assistant-grade-scheme.interface';

interface UseAssistantGradeSchemeFormOptions {
  initialValue?: IAssistantGradeSchemeCreate;
}

export function useAssistantGradeSchemeForm(options: UseAssistantGradeSchemeFormOptions = {}) {
  const [form, setForm] = useState<IAssistantGradeSchemeCreate>(
    options.initialValue ?? {
      assistantPercentage: 0,
      name: 'Evaluación del auxiliar',
      description: '',
      details: [],
    },
  );

  useEffect(() => {
    if (!options.initialValue) return;

    setForm(options.initialValue);
  }, [options.initialValue]);

  const updateField = <K extends keyof IAssistantGradeSchemeCreate>(key: K, value: IAssistantGradeSchemeCreate[K]) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handleGradeItemChange = (gradeItem: IGradeItem, checked: boolean) => {
    setForm((current) => {
      if (checked) {
        const exists = current.details.some((detail) => detail.gradeItem.idGradeItem === gradeItem.idGradeItem);

        if (exists) {
          return current;
        }

        const original = options.initialValue?.details.find(
          (detail) => detail.gradeItem.idGradeItem === gradeItem.idGradeItem,
        );

        const newDetail: IAssistantGradeSchemeDetailCreate = {
          gradeItem: {
            idGradeItem: gradeItem.idGradeItem,
          },
          ...original,
          percentage: original?.percentage ?? 0,
          order: current.details.length + 1,
        };

        return {
          ...current,
          details: [...current.details, newDetail],
          deactivateDetailIds: current.deactivateDetailIds?.filter((id) => id !== original?.idGradeSchemeDetail),
        };
      }

      const details = current.details
        .filter((detail) => detail.gradeItem.idGradeItem !== gradeItem.idGradeItem)
        .map((detail, index) => ({
          ...detail,
          order: index + 1,
        }));

      const removed = current.details.find((detail) => detail.gradeItem.idGradeItem === gradeItem.idGradeItem);

      return {
        ...current,
        details,
        deactivateDetailIds:
          removed?.hasAcademicData && removed.idGradeSchemeDetail
            ? [...new Set([...(current.deactivateDetailIds ?? []), removed.idGradeSchemeDetail])]
            : current.deactivateDetailIds,
      };
    });
  };

  const handlePercentageChange = (idGradeItem: number, percentage: number) => {
    setForm((current) => ({
      ...current,
      details: current.details.map((detail) =>
        detail.gradeItem.idGradeItem === idGradeItem
          ? {
              ...detail,
              percentage,
            }
          : detail,
      ),
    }));
  };

  const handlePermissionWeightChange = (idGradeItem: number, permissionWeight: number) => {
    setForm((current) => ({
      ...current,
      details: current.details.map((detail) =>
        detail.gradeItem.idGradeItem === idGradeItem ? { ...detail, permissionWeight } : detail,
      ),
    }));
  };

  const totalPercentage = useMemo(
    () => form.details.reduce((sum, detail) => sum + detail.percentage, 0),
    [form.details],
  );

  const isValid =
    form.assistantPercentage > 0 &&
    form.assistantPercentage <= 100 &&
    form.details.length > 0 &&
    totalPercentage === 100 &&
    form.details.every(
      (detail) =>
        Number.isInteger(detail.percentage) &&
        detail.percentage >= 0 &&
        detail.percentage <= 100 &&
        Number.isFinite(detail.permissionWeight ?? 1) &&
        (detail.permissionWeight ?? 1) >= 0 &&
        (detail.permissionWeight ?? 1) <= 1,
    );

  const reset = () => {
    setForm({
      assistantPercentage: 0,
      name: 'Evaluación del auxiliar',
      description: '',
      details: [],
    });
  };

  return {
    form,
    updateField,
    handleGradeItemChange,
    handlePercentageChange,
    handlePermissionWeightChange,
    totalPercentage,
    isValid,
    reset,
  };
}
