import { renderToStaticMarkup } from 'react-dom/server';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { StudentAttendanceCheckIn, StudentAttendanceRegistration } from './StudentAttendanceCheckIn';
import type { IEnrollment } from '@/interfaces/enrollments/enrollment.interface';
import type { IMyAttendanceSession } from '@/interfaces/attendances/student-attendance.interface';
import { AttendanceStatus } from '@/enums/attendanceStatus';
import { UserRole } from '@/enums/userRole';

const mocks = vi.hoisted(() => ({
  user: { idUser: 5, roles: ['STUDENT', 'ASSISTANT'], permissions: ['attendance.check-in'] },
  hook: vi.fn(),
  state: {
    sessions: [] as IMyAttendanceSession[],
    phase: 'IDLE',
    loading: false,
    listError: '',
    hasMore: false,
    activeSessionId: null as number | null,
    feedback: null as { severity: string; message: string } | null,
    blockedIds: [] as number[],
    reload: vi.fn(),
    checkIn: vi.fn(),
  },
}));

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('@/hooks/attendances/useStudentAttendanceCheckIn', () => ({
  useStudentAttendanceCheckIn: (...args: unknown[]) => {
    mocks.hook(...args);

    return mocks.state;
  },
}));
const enrollment = { idEnrollment: 20, user: { idUser: 5 }, isActive: true, role: UserRole.STUDENT } as IEnrollment;

const session: IMyAttendanceSession = {
  idAttendanceSession: 7,
  date: '2026-10-27',
  startsAt: '2026-10-27T14:00:00Z',
  endsAt: '2026-10-27T15:00:00Z',
  state: 'OPEN',
  isComputable: false,
  alreadyRegistered: false,
  ownStatus: null,
  ownMarkedAt: null,
};

const html = () =>
  renderToStaticMarkup(<StudentAttendanceRegistration idEnrollment={20} onAcademicRefresh={vi.fn()} />);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user.idUser = 5;
  mocks.user.permissions = ['attendance.check-in'];
  Object.assign(mocks.state, {
    sessions: [],
    phase: 'IDLE',
    loading: false,
    listError: '',
    hasMore: false,
    activeSessionId: null,
    feedback: null,
    blockedIds: [],
  });
});

describe('student registration card', () => {
  it('shows a discreet empty state, separate from academic counters', () => {
    expect(html()).toContain('Registro de asistencia');
    expect(html()).toContain('No hay una sesión');
    expect(html()).not.toContain('Marcar asistencia</button>');
  });
  it('shows all open sessions and only the next scheduled session', () => {
    mocks.state.sessions = [
      session,
      { ...session, idAttendanceSession: 8 },
      { ...session, idAttendanceSession: 9, state: 'SCHEDULED' },
      { ...session, idAttendanceSession: 10, state: 'SCHEDULED' },
    ];
    const result = html();

    expect(result).toContain('Sesión #7');
    expect(result).toContain('Sesión #8');
    expect(result).toContain('Sesión #9');
    expect(result).not.toContain('Sesión #10');
    expect(result.match(/>Marcar asistencia<\/button>/g)).toHaveLength(2);
    expect(result).toContain('Bolivia');
  });
  it('scheduled has a start time and no active check-in', () => {
    mocks.state.sessions = [{ ...session, state: 'SCHEDULED' }];
    const result = html();

    expect(result).toContain('Próxima sesión');
    expect(result).toContain('Disponible desde');
    expect(result).not.toContain('Marcar asistencia</button>');
  });
  it.each([AttendanceStatus.PRESENT, AttendanceStatus.EXCUSED, AttendanceStatus.ABSENT])(
    'shows own status %s without enabling another check-in',
    (ownStatus) => {
      mocks.state.sessions = [{ ...session, alreadyRegistered: true, ownStatus, ownMarkedAt: '2026-10-27T14:03:00Z' }];
      const result = html();

      expect(result).toContain('Asistencia registrada');
      expect(result).toContain('sesión en curso');
      expect(result).toContain('Registrada:');
      expect(result).not.toContain('Marcar asistencia</button>');
    },
  );
  it.each(['OBTAINING_LOCATION', 'CHECKING_IN'])('announces %s and disables check-in', (phase) => {
    mocks.state.sessions = [session];
    mocks.state.phase = phase;
    mocks.state.activeSessionId = 7;
    const result = html();

    expect(result).toContain(phase === 'OBTAINING_LOCATION' ? 'Obteniendo ubicación...' : 'Verificando ubicación...');
    expect(result).toMatch(/<button[^>]*disabled[^>]*>/);
  });
  it('never renders center, radius or student coordinates even if an extra field sneaks into a response', () => {
    mocks.state.sessions = [
      Object.assign(
        { ...session },
        { latitude: -19.572312, longitude: -65.755123, radiusMeters: 123, maximumAcceptedAccuracy: 18 },
      ),
    ];
    const result = html();

    expect(result).not.toContain('-19.572312');
    expect(result).not.toContain('-65.755123');
    expect(result).not.toContain('radiusMeters');
    expect(result).not.toContain('leaflet');
    expect(result).toContain('no se realiza seguimiento continuo');
  });
  it('permits multi-role users through enrollment ownership, not a STUDENT-only global role check', () => {
    renderToStaticMarkup(<StudentAttendanceCheckIn enrollment={enrollment} onAcademicRefresh={vi.fn()} />);
    expect(mocks.hook).toHaveBeenCalledWith(20, expect.any(Function));
  });
  it.each(['foreign', 'inactive', 'wrongRole', 'invalidId', 'noPermission'])(
    'does not load sessions for %s context',
    (kind) => {
      let value = enrollment;

      if (kind === 'foreign') mocks.user.idUser = 6;
      if (kind === 'inactive') value = { ...enrollment, isActive: false };
      if (kind === 'wrongRole') value = { ...enrollment, role: UserRole.ASSISTANT };
      if (kind === 'invalidId') value = { ...enrollment, idEnrollment: NaN };
      if (kind === 'noPermission') mocks.user.permissions = [];
      renderToStaticMarkup(<StudentAttendanceCheckIn enrollment={value} onAcademicRefresh={vi.fn()} />);
      expect(mocks.hook).not.toHaveBeenCalled();
    },
  );
});
