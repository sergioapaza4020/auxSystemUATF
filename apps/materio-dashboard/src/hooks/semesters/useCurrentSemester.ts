'use client';

import { useCallback, useEffect, useState } from 'react';

import { getCurrentSemester } from '@/api/semesters.service';

import type { ISemester } from '@/interfaces/semesters/semester.interface';

export function useCurrentSemester() {
  const [semester, setSemester] = useState<ISemester | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const data = await getCurrentSemester();

      setSemester(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    semester,
    loading,
    load,
  };
}
