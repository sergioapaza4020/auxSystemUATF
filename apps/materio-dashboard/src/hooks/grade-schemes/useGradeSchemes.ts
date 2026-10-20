import { getGradeSchemesPage } from '@/api/grade-scheme.service';
import { useCatalogPage } from '@/hooks/useCatalogPage';

export function useGradeSchemes() {
  const page = useCatalogPage(getGradeSchemesPage, true, 'idGradeScheme');

  return { ...page, gradeSchemes: page.rows, load: page.reload };
}
