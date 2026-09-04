import { useCallback, useEffect, useState } from 'react';

import { getGradesByEnrollment } from '@/api/grades.service';
import type { IGrade } from '@/interfaces/grades/grade.interface';

export function useEnrollmentGrades(idEnrollment: number) {
  const [grades, setGrades] = useState<IGrade[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const data = await getGradesByEnrollment(idEnrollment);

      setGrades(data);
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
    load,
  };
}
