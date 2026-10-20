'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { getEnrollmentsPage } from '@/api/enrollments.service';
import type { IEnrollment } from '@/interfaces/enrollments/enrollment.interface';
import type { PaginationMeta } from '@/interfaces/apiResponse';
import type { RecordStatus } from '@/interfaces/status-query.interface';
import { getApiErrorMessage } from '@/utils/http/getApiErrorMessage';

export interface EnrollmentsPageQuery {
  search: string;
  status: RecordStatus;
  page: number;
  limit: number;
}

export function useEnrollmentsPage(enabled: boolean) {
  const [query, setQuery] = useState<EnrollmentsPageQuery>({ search: '', status: 'active', page: 1, limit: 20 });
  const [rows, setRows] = useState<IEnrollment[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const request = useRef<AbortController | null>(null);

  const changeQuery = (patch: Partial<EnrollmentsPageQuery>) => {
    request.current?.abort();
    setLoading(true);
    setError('');
    setQuery((previous) => ({ ...previous, ...patch, page: patch.page ?? 1 }));
  };

  const reload = useCallback(() => {
    request.current?.abort();
    setLoading(true);
    setRevision((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();

    request.current = controller;
    setLoading(true);
    setError('');

    const timer = window.setTimeout(() => {
      void getEnrollmentsPage({ ...query, search: query.search.trim() || undefined }, controller.signal)
        .then((response) => {
          if (controller.signal.aborted) return;

          if (query.page > Math.max(1, response.meta.totalPages)) {
            setQuery((previous) => ({ ...previous, page: Math.max(1, response.meta.totalPages) }));

            return;
          }

          setRows(response.data);
          setMeta(response.meta);
          setLoading(false);
        })
        .catch((cause) => {
          if (controller.signal.aborted) return;
          setError(getApiErrorMessage(cause));
          setLoading(false);
        });
    }, 0);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [enabled, query, revision]);

  return { query, rows, meta, loading, error, changeQuery, reload };
}
