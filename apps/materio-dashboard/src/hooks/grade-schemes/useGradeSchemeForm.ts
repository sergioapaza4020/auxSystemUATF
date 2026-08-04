'use client';

import { useEffect, useMemo, useState } from 'react';

import type { IGradeSchemeCreateOrEdit } from '@/interfaces/grade-schemes/grade-scheme-edit.interface';
import type { IGradeItem } from '@/interfaces/grade-items/grade-item.interface';

import { INITIAL_GRADE_SCHEME } from './constants';
import { calculateTotalPercentage, changePercentage, toggleGradeItem } from './helpers';
import { isGradeSchemeValid } from './validators';

interface Props {
  initialValue?: IGradeSchemeCreateOrEdit;
}

export function useGradeSchemeForm(props?: Props) {
  const { initialValue } = props ?? {};

  const [gradeScheme, setGradeScheme] = useState<IGradeSchemeCreateOrEdit>(initialValue ?? INITIAL_GRADE_SCHEME);

  useEffect(() => {
    if (initialValue) {
      setGradeScheme(structuredClone(initialValue));
    }
  }, [initialValue]);

  const updateField = <K extends keyof IGradeSchemeCreateOrEdit>(key: K, value: IGradeSchemeCreateOrEdit[K]) => {
    setGradeScheme((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleGradeItemChange = (gradeItem: IGradeItem, checked: boolean) => {
    setGradeScheme((prev) => ({
      ...prev,
      details: toggleGradeItem(prev.details, gradeItem, checked),
    }));
  };

  const handlePercentageChange = (idGradeItem: number, percentage: number) => {
    setGradeScheme((prev) => ({
      ...prev,
      details: changePercentage(prev.details, idGradeItem, percentage),
    }));
  };

  const totalPercentage = useMemo(() => calculateTotalPercentage(gradeScheme.details), [gradeScheme.details]);

  const isValid = useMemo(() => isGradeSchemeValid(gradeScheme), [gradeScheme]);

  const reset = () => {
    setGradeScheme(INITIAL_GRADE_SCHEME);
  };

  return {
    gradeScheme,

    updateField,
    handleGradeItemChange,
    handlePercentageChange,

    totalPercentage,
    isValid,

    reset,
    setGradeScheme,
  };
}
