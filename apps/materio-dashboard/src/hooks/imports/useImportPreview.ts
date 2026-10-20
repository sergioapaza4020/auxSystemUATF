'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { ImportPreviewPage, ImportPreviewQuery } from '@/interfaces/import-preview.interface';
import { getApiErrorMessage } from '@/utils/http/getApiErrorMessage';

/** The POST already supplies page one. Later requests keep the previous page visible. */
export function useImportPreview<Row>(
  initial: ImportPreviewPage<Row>,
  enabled: boolean,
  loadPage: (operationId: string, query: ImportPreviewQuery, signal?: AbortSignal) => Promise<ImportPreviewPage<Row>>,
) {
  const [query, setQuery] = useState<ImportPreviewQuery>({
    page: initial.meta.page,
    limit: initial.meta.limit,
    search: '',
    status: 'all',
  });

  const [rows, setRows] = useState(initial.data);
  const [meta, setMeta] = useState(initial.meta);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const initialQuery = useRef(query);
  const request = useRef<AbortController | null>(null);
  const delay = useRef(0);

  const changeQuery = (patch: Partial<ImportPreviewQuery>) => {
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
    if (!enabled || (query === initialQuery.current && revision === 0)) return;
    const controller = new AbortController();

    request.current = controller;
    setLoading(true);
    setError('');

    const timer = window.setTimeout(() => {
      void loadPage(initial.operationId, query, controller.signal)
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
        .catch((cause: unknown) => {
          if (controller.signal.aborted) return;
          setError(getApiErrorMessage(cause));
          setLoading(false);
        });
    }, delay.current);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [enabled, initial.operationId, query, revision, loadPage]);

  return { query, rows, meta, loading, error, changeQuery, reload };
}
