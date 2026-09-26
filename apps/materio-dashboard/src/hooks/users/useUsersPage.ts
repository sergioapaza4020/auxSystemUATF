'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { getUsersPage } from '@/api/users.service';
import type { IUser } from '@/interfaces/users/user.interface';
import type { PaginationMeta } from '@/interfaces/apiResponse';
import type { RecordStatus } from '@/interfaces/status-query.interface';
import { getApiErrorMessage } from '@/utils/http/getApiErrorMessage';

export interface UsersPageQuery {
  search: string;
  status: RecordStatus;
  role: string;
  page: number;
  limit: number;
}

export function useUsersPage(enabled: boolean) {
  const [query, setQuery] = useState<UsersPageQuery>({ search: '', status: 'all', role: '', page: 1, limit: 10 });
  const [rows, setRows] = useState<IUser[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const request = useRef<AbortController | null>(null);
  const delay = useRef(0);

  const changeQuery = (patch: Partial<UsersPageQuery>) => {
    request.current?.abort();
    setLoading(true);
    setError('');
    delay.current = patch.search !== undefined ? 350 : 0;
    setQuery((previous) => ({ ...previous, ...patch, page: patch.page ?? 1 }));
  };

  const reload = useCallback(() => {
    request.current?.abort();
    delay.current = 0;
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
      void getUsersPage(
        { ...query, search: query.search.trim() || undefined, role: query.role ? [query.role] : undefined },
        controller.signal,
      )
        .then((response) => {
          if (controller.signal.aborted) return;

          if (query.page > Math.max(1, response.meta.totalPages)) {
            delay.current = 0;
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
    }, delay.current);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [enabled, query, revision]);

  return { query, rows, meta, loading, error, changeQuery, reload };
}
