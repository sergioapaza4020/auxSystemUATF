import { useCallback, useEffect, useState } from 'react';

import { getGradesByEnrollment } from '@/api/grades.service';
import type { IGrade } from '@/interfaces/grades/grade.interface';
import { getApiErrorMessage } from '@/utils/http/getApiErrorMessage';

export function useEnrollmentGrades(idEnrollment: number) {
  const [grades, setGrades] = useState<IGrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getGradesByEnrollment(idEnrollment);

      setGrades(data);
    } catch (reason) {
      setGrades([]);
      setError(getApiErrorMessage(reason));
    } finally {
      setLoading(false);
    }
  }, [idEnrollment]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    grades,
    loading,
    error,
    load,
  };
}
