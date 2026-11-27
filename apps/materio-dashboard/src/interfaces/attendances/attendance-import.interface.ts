import type { AttendanceStatus } from '@/enums/attendanceStatus';

export type AttendanceImportChoice = { column: string; sessionId: number | 'create' };
export type AttendanceImportSummary = {
  identified: number;
  dates: number;
  reused: number;
  newSessions: number;
  present: number;
  absent: number;
  excused: number;
  empty: number;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  warnings: number;
};

type Session = {
  id: number;
  mode: string;
  state: string;
  editable: boolean;
  topic?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
};

export type AttendanceImportPreview = {
  operationId: string | null;
  columns: {
    column: string;
    date: string | null;
    candidates: Session[];
    selected?: Session;
    create: boolean;
    allowCreate: boolean;
  }[];
  cells: {
    column: string;
    row: number;
    ru: string;
    date: string | null;
    sessionId: number | null;
    status: AttendanceStatus;
    empty: boolean;
    previous: AttendanceStatus | null;
    action: 'create' | 'update' | 'skip' | 'blocked';
  }[];
  errors: { row: number; column: string; ru?: string; message: string }[];
  warnings: string[];
  summary: AttendanceImportSummary;
};
