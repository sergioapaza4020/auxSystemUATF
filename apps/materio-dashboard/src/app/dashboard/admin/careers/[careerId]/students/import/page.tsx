import { CareerStudentImportPage } from '@/views/admin/careers/import/CareerStudentImportPage';

export default function ImportCareerStudentsPage({ params }: { params: { careerId: string } }) {
  return <CareerStudentImportPage key={params.careerId} careerId={Number(params.careerId)} />;
}
