import { useCallback, useEffect, useRef, useState } from 'react';

import type { CatalogPageQuery } from '@/interfaces/catalog-page.interface';
import type { PaginatedApiResponse, PaginationMeta } from '@/interfaces/apiResponse';
import { getApiErrorMessage } from '@/utils/http/getApiErrorMessage';

type FetchPage<T> = (query: CatalogPageQuery, signal?: AbortSignal) => Promise<PaginatedApiResponse<T[]>>;

export function useCatalogPage<T>(fetchPage: FetchPage<T>, enabled = true, initialSort?: CatalogPageQuery['sortBy']) {
  const [query, setQuery] = useState<CatalogPageQuery>({
    page: 1,
    limit: 5,
    search: '',
    status: 'all',
    ...(initialSort ? { sortBy: initialSort, sortOrder: 'DESC' as const } : {}),
  });

  const [rows, setRows] = useState<T[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, limit: 5, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const request = useRef<AbortController | null>(null);

  const changeQuery = (patch: Partial<CatalogPageQuery>) => {
    request.current?.abort();
    setLoading(true);
    setError('');
    setQuery((previous) => ({ ...previous, ...patch, page: patch.page ?? 1 }));
  };

  const reload = useCallback(() => {
    request.current?.abort();
    setLoading(true);
    setRevision((value) => value + 1);

    return Promise.resolve();
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();

    request.current = controller;
    setLoading(true);
    setError('');

    const timer = window.setTimeout(
      () => {
        void fetchPage({ ...query, search: query.search.trim() }, controller.signal)
          .then((response) => {
            if (controller.signal.aborted) return;
            const lastPage = Math.max(1, response.meta.totalPages);

            if (query.page > lastPage) {
              setQuery((previous) => ({ ...previous, page: lastPage }));

              return;
            }

            setRows(response.data);
            setMeta(response.meta);
            setLoading(false);
          })
          .catch((cause: unknown) => {
            if (controller.signal.aborted) return;
            setError(getApiErrorMessage(cause));
            setLoading(false);
          });
      },
      query.search ? 300 : 0,
    );

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [fetchPage, enabled, query, revision]);

  return { query, rows, meta, loading, error, changeQuery, reload };
}
