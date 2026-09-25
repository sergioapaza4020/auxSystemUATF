'use client';

import { useCallback, useEffect, useState } from 'react';

import { getStudentAttendance } from '@/api/attendances.service';
import type { IStudentAttendance } from '@/interfaces/attendances/attendance.interface';

export function useStudentAttendance(idEnrollment: number | null) {
  const [attendance, setAttendance] = useState<IStudentAttendance | null>(null);

  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!idEnrollment) {
      setAttendance(null);

      return;
    }

    setLoading(true);

    try {
      const data = await getStudentAttendance(idEnrollment);

      setAttendance(data);
    } finally {
      setLoading(false);
    }
  }, [idEnrollment]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    attendance,
    loading,
    load,
  };
}
