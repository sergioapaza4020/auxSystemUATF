import { EnrollmentImportPage } from '@/views/admin/enrollments/import/EnrollmentImportPage';

export default function ImportStudentsPage({ params }: { params: { idEnrollment: string } }) {
  return <EnrollmentImportPage key={params.idEnrollment} idEnrollment={Number(params.idEnrollment)} />;
}
