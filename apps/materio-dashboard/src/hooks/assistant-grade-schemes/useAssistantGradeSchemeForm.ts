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

        const newDetail: IAssistantGradeSchemeDetailCreate = {
          gradeItem: {
            idGradeItem: gradeItem.idGradeItem,
          },
          percentage: 0,
          order: current.details.length + 1,
        };

        return {
          ...current,
          details: [...current.details, newDetail],
        };
      }

      const details = current.details
        .filter((detail) => detail.gradeItem.idGradeItem !== gradeItem.idGradeItem)
        .map((detail, index) => ({
          ...detail,
          order: index + 1,
        }));

      return {
        ...current,
        details,
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

  const totalPercentage = useMemo(
    () => form.details.reduce((sum, detail) => sum + detail.percentage, 0),
    [form.details],
  );

  const isValid =
    form.assistantPercentage > 0 &&
    form.assistantPercentage <= 100 &&
    form.details.length > 0 &&
    totalPercentage === 100;

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
    totalPercentage,
    isValid,
    reset,
  };
}
