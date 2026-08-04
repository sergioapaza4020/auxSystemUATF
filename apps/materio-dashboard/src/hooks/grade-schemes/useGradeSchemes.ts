'use client';

import { useCallback, useEffect, useState } from 'react';

import { getGradeSchemes } from '@/api/grade-scheme.service';

import type { IGradeScheme } from '@/interfaces/grade-schemes/grade-scheme.interface';
import { useSnackbar } from '../useSnackbar';
import { getApiErrorMessage } from '@/utils/http/getApiErrorMessage';

export function useGradeSchemes() {
  const [gradeSchemes, setGradeSchemes] = useState<IGradeScheme[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const snackbar = useSnackbar();

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const data = await getGradeSchemes();

      setGradeSchemes(data);
    } catch (error) {
      snackbar.error(getApiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [snackbar]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    gradeSchemes,
    loading,

    load,
  };
}
