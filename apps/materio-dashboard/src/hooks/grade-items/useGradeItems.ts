import { useCallback, useEffect, useState } from 'react';

import { getGradeItems } from '@/api/grade-items.service';

import type { IGradeItem } from '@/interfaces/grade-items/grade-item.interface';
import { useSnackbar } from '../useSnackbar';
import { getApiErrorMessage } from '@/utils/http/getApiErrorMessage';

export function useGradeItems() {
  const [gradeItems, setGradeItems] = useState<IGradeItem[]>([]);
  const [loading, setLoading] = useState(false);

  const snackbar = useSnackbar();

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const data = await getGradeItems();

      setGradeItems(data);
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
    gradeItems,
    loading,

    load,
  };
}
