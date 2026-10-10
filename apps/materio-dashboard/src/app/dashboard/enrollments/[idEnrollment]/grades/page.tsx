'use client';

import { useParams } from 'next/navigation';

import { GradeManagement } from '@/views/admin/enrollments/grade-management/GradeManagement';

export default function EnrollmentGradesPage() {
  const params = useParams();
  const idEnrollment = Number(params.idEnrollment);

  return <GradeManagement key={idEnrollment} idEnrollment={idEnrollment} />;
}
