import { useEffect, useMemo, useRef, useState } from 'react';

import {
  getAttendanceSessionPage,
  type AttendanceSessionPage,
  type IAttendanceRecord,
} from '@/api/attendances.service';
import { getEnrollmentStudentsPage, type StudentRosterQuery } from '@/api/enrollments.service';
import type { PaginationMeta } from '@/interfaces/apiResponse';
import type { IEnrollmentStudent } from '@/interfaces/enrollments/enrollment-student.interface';
import { AttendanceStatus } from '@/enums/attendanceStatus';
import { normalizeAttendanceObservation } from '@/utils/attendance-draft';
import { getApiErrorMessage } from '@/utils/http/getApiErrorMessage';

type Mark = { status: AttendanceStatus; observation: string | null };
const absent: Mark = { status: AttendanceStatus.ABSENT, observation: null };

export function useAttendanceRoster(idEnrollment: number, sessionId: number | null) {
  const scope = `${idEnrollment}:${sessionId ?? 'roster'}`;
  const [loadedScope, setLoadedScope] = useState<string | null>(null);
  const [query, setQuery] = useState<StudentRosterQuery>({ page: 1, limit: 25, search: '' });
  const [students, setStudents] = useState<IEnrollmentStudent[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, limit: 25, total: 0, totalPages: 0 });
  const [session, setSession] = useState<AttendanceSessionPage | null>(null);
  const [originals, setOriginals] = useState<Record<number, Mark>>({});
  const [geographicStudentIds, setGeographicStudentIds] = useState<number[]>([]);
  const [drafts, setDrafts] = useState<Record<number, Mark>>({});
  const [markAll, setMarkAll] = useState<AttendanceStatus | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const request = useRef<AbortController | null>(null);
  const delay = useRef(0);
  const draftRef = useRef(drafts);

  draftRef.current = drafts;

  useEffect(() => {
    setStudents([]);
    setOriginals({});
    setGeographicStudentIds([]);
    setDrafts({});
    setMarkAll(undefined);
    setSession(null);
    setQuery((current) => ({ ...current, page: 1 }));
  }, [idEnrollment, sessionId]);

  const changeQuery = (patch: Partial<StudentRosterQuery>) => {
    request.current?.abort();
    setLoading(true);
    delay.current = patch.search !== undefined ? 350 : 0;
    setQuery((current) => ({ ...current, ...patch, page: patch.page ?? 1 }));
  };

  useEffect(() => {
    const controller = new AbortController();

    request.current = controller;
    setLoading(true);
    setError('');

    const timer = window.setTimeout(() => {
      const load = async () => {
        if (!sessionId) {
          const response = await getEnrollmentStudentsPage(idEnrollment, query, controller.signal);

          return { students: response.data, session: null, meta: response.meta };
        }

        const response = await getAttendanceSessionPage(sessionId, query, controller.signal);

        return { students: response.data.students, session: response.data, meta: response.meta };
      };

      void load()
        .then((data) => {
          if (controller.signal.aborted) return;

          if (query.page > Math.max(1, data.meta.totalPages)) {
            setQuery((current) => ({ ...current, page: Math.max(1, data.meta.totalPages) }));

            return;
          }

          setLoadedScope(scope);
          setStudents(data.students);
          setMeta(data.meta);
          setSession(data.session);

          if (data.session) {
            const geoIds = data.session.attendances
              .filter(
                (mark) =>
                  mark.registrationMethod === 'GEOLOCATION' ||
                  mark.registrationMethod === 'QR' ||
                  mark.registrationMethod === 'GEOLOCATION_QR',
              )
              .map((mark) => mark.enrollment.idEnrollment);

            setGeographicStudentIds((current) => [...new Set([...current, ...geoIds])]);

            if (geoIds.length) {
              setMarkAll(undefined);
              setDrafts((current) =>
                Object.fromEntries(Object.entries(current).filter(([id]) => !geoIds.includes(Number(id)))),
              );
            }

            const marks = new Map(data.session.attendances.map((mark) => [mark.enrollment.idEnrollment, mark]));

            setOriginals((current) => {
              const next = { ...current };

              for (const student of data.students) {
                const id = student.idEnrollment;

                if (id in draftRef.current && !geoIds.includes(id)) continue;
                const mark = marks.get(id);

                next[id] = {
                  status: mark?.status ?? AttendanceStatus.ABSENT,
                  observation:
                    data.session?.mode === 'GEOLOCATION_QR'
                      ? (mark?.observation ?? null)
                      : normalizeAttendanceObservation(mark?.status ?? AttendanceStatus.ABSENT, mark?.observation),
                };
              }

              return next;
            });
          }
        })
        .catch((cause) => {
          if (!controller.signal.aborted) {
            setError(getApiErrorMessage(cause));
            setStudents([]);
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
  }, [idEnrollment, sessionId, query, revision, scope]);

  const current = (id: number): Mark =>
    drafts[id] ?? (markAll ? { status: markAll, observation: null } : (originals[id] ?? absent));

  const attendance: Record<number, AttendanceStatus> = {};
  const observations: Record<number, string | null> = {};

  for (const id of new Set([
    ...Object.keys(originals),
    ...Object.keys(drafts),
    ...students.map((student) => String(student.idEnrollment)),
  ])) {
    const mark = current(Number(id));

    attendance[Number(id)] = mark.status;
    observations[Number(id)] = mark.observation;
  }

  const modifiedStudentIds = Object.keys(drafts)
    .map(Number)
    .filter((id) => {
      const old = markAll ? { status: markAll, observation: null } : (originals[id] ?? absent);

      return (
        drafts[id].status !== old.status ||
        normalizeAttendanceObservation(drafts[id].status, drafts[id].observation) !==
          normalizeAttendanceObservation(old.status, old.observation)
      );
    });

  const total = session?.totalStudents ?? meta.total;

  const counts = useMemo(() => {
    if (session?.mode === 'GEOLOCATION_QR')
      return { present: session.presentCount, excused: session.excusedCount, absent: session.absentCount };
    let present = markAll ? (markAll === AttendanceStatus.PRESENT ? total : 0) : (session?.presentCount ?? 0);
    let excused = markAll ? (markAll === AttendanceStatus.EXCUSED ? total : 0) : (session?.excusedCount ?? 0);

    for (const [key, draft] of Object.entries(drafts)) {
      const old = markAll ? { status: markAll } : (originals[Number(key)] ?? absent);

      present += Number(draft.status === AttendanceStatus.PRESENT) - Number(old.status === AttendanceStatus.PRESENT);
      excused += Number(draft.status === AttendanceStatus.EXCUSED) - Number(old.status === AttendanceStatus.EXCUSED);
    }

    return { present, excused, absent: total - present - excused };
  }, [session, total, drafts, originals, markAll]);

  const edit = (id: number, status: AttendanceStatus, observation?: string | null) => {
    if (loadedScope !== scope || session?.mode === 'GEOLOCATION_QR' || geographicStudentIds.includes(id)) return;
    setDrafts((previous) => ({
      ...previous,
      [id]: {
        status,
        observation:
          status === AttendanceStatus.EXCUSED
            ? observation === undefined
              ? current(id).observation
              : observation
            : null,
      },
    }));
  };

  const discard = () => {
    setDrafts({});
    setMarkAll(undefined);
  };

  const confirmed = () => {
    discard();
    setOriginals({});
    setRevision((value) => value + 1);
  };

  const payload = (): { attendances: IAttendanceRecord[]; markAll?: AttendanceStatus } => ({
    markAll,
    attendances: modifiedStudentIds
      .filter((id) => !geographicStudentIds.includes(id))
      .map((id) => ({
        enrollmentId: id,
        status: drafts[id].status,
        observation: normalizeAttendanceObservation(drafts[id].status, drafts[id].observation),
      })),
  });

  return {
    students: loadedScope === scope ? students : [],
    meta: loadedScope === scope ? meta : { page: 1, limit: query.limit, total: 0, totalPages: 0 },
    query,
    session: loadedScope === scope ? session : null,
    loading: loading || (!error && loadedScope !== scope),
    error,
    attendance: loadedScope === scope ? attendance : {},
    observations: loadedScope === scope ? observations : {},
    geographicStudentIds: loadedScope === scope ? geographicStudentIds : [],
    protectedStudentIds: loadedScope === scope ? geographicStudentIds : [],
    modifiedStudentIds,
    total: loadedScope === scope ? total : 0,
    counts: loadedScope === scope ? counts : { present: 0, excused: 0, absent: 0 },
    markAllActive: markAll !== undefined,
    hasChanges: markAll !== undefined || modifiedStudentIds.length > 0,
    changeQuery,
    edit,
    discard,
    confirmed,
    refresh: () => setRevision((value) => value + 1),
    payload,
    markAllStudents: (status: AttendanceStatus) => {
      if (loadedScope !== scope || session?.mode === 'GEOLOCATION_QR' || geographicStudentIds.length) return;
      setMarkAll(status);
      setDrafts({});
    },
  };
}
