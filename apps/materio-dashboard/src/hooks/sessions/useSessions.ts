'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { getAllSessions } from '@/api/sessions.service';
import type { ISession } from '@/interfaces/sessions/session.interface';
import type { PaginationMeta } from '@/interfaces/apiResponse';
import { getApiErrorMessage } from '@/utils/http/getApiErrorMessage';

export interface SessionsPageQuery {
  page: number;
  limit: number;
}

export function useSessions(enabled = true) {
  const [query, setQuery] = useState<SessionsPageQuery>({ page: 1, limit: 5 });
  const [rows, setRows] = useState<ISession[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, limit: 5, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const request = useRef<AbortController | null>(null);

  const changeQuery = (patch: Partial<SessionsPageQuery>) => {
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
      void getAllSessions(query, controller.signal)
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

  return { query, sessions: rows, meta, loading, error, changeQuery, load: reload };
}
