import { useEffect, useState } from 'react';

import { getStudentGradeSummary } from '@/api/enrollments.service';
import type { IStudentGradeSummary } from '@/interfaces/enrollments/student-grade-summary.interface';
import { getApiErrorMessage } from '@/utils/http/getApiErrorMessage';

export function useStudentGradeSummary(idEnrollment: number | null, revision: unknown) {
  const [summary, setSummary] = useState<IStudentGradeSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    setSummary(null);
    setError(null);

    if (idEnrollment === null) {
      setLoading(false);

      return () => controller.abort();
    }

    setLoading(true);
    void getStudentGradeSummary(idEnrollment, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setSummary(data);
      })
      .catch((reason) => {
        if (!controller.signal.aborted) setError(getApiErrorMessage(reason));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [idEnrollment, revision, retry]);

  return { summary, loading, error, reload: () => setRetry((value) => value + 1) };
}
