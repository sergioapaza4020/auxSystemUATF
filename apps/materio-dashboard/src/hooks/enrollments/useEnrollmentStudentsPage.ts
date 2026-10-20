import { useCallback, useEffect, useRef, useState } from 'react';

import {
  getEnrollmentStudentsPage,
  getStudentGradeSummaryPage,
  type StudentRosterQuery,
} from '@/api/enrollments.service';
import type { IEnrollmentStudent } from '@/interfaces/enrollments/enrollment-student.interface';
import type { IStudentGradeSummary } from '@/interfaces/enrollments/student-grade-summary.interface';
import type { PaginationMeta } from '@/interfaces/apiResponse';
import { getApiErrorMessage } from '@/utils/http/getApiErrorMessage';

export function useEnrollmentStudentsPage(id: number | null, withGrades: boolean, revision?: unknown) {
  const [query, setQuery] = useState<StudentRosterQuery>({ page: 1, limit: 10, search: '' });
  const [students, setStudents] = useState<IEnrollmentStudent[]>([]);
  const [summary, setSummary] = useState<IStudentGradeSummary | null>(null);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const request = useRef<AbortController | null>(null);
  const delay = useRef(0);

  const changeQuery = (patch: Partial<StudentRosterQuery>) => {
    request.current?.abort();
    setLoading(true);
    delay.current = patch.search !== undefined ? 350 : 0;
    setQuery((current) => ({ ...current, ...patch, page: patch.page ?? 1 }));
  };

  const reload = useCallback(() => setRetry((value) => value + 1), []);

  useEffect(() => {
    if (id === null) return;
    const controller = new AbortController();

    request.current = controller;
    setLoading(true);
    setError(null);

    const timer = window.setTimeout(() => {
      const load = async () => {
        if (withGrades) {
          const response = await getStudentGradeSummaryPage(id, query, controller.signal);

          return { students: response.data.roster, summary: response.data, meta: response.meta };
        }

        const response = await getEnrollmentStudentsPage(id, query, controller.signal);

        return { students: response.data, summary: null, meta: response.meta };
      };

      void load()
        .then((response) => {
          if (controller.signal.aborted) return;

          if (query.page > Math.max(1, response.meta.totalPages)) {
            setQuery((current) => ({ ...current, page: Math.max(1, response.meta.totalPages) }));

            return;
          }

          setStudents(response.students);
          setSummary(response.summary);
          setMeta(response.meta);
        })
        .catch((cause) => {
          if (!controller.signal.aborted) {
            setError(getApiErrorMessage(cause));
            setStudents([]);
            setSummary(null);
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, delay.current);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [id, withGrades, query, revision, retry]);

  return { students, summary, meta, query, loading, error, changeQuery, reload };
}
