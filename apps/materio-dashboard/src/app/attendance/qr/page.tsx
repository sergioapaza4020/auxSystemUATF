import { StudentQrAttendance } from '@/views/attendance/StudentQrAttendance';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const metadata = {
  title: 'Registrar asistencia | UATF',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default function QrAttendancePage() {
  return <StudentQrAttendance />;
}
