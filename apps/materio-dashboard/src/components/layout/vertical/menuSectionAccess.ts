import { UserRole } from '@/enums/userRole';
import type { ICurrentUser } from '@/interfaces/auth/current-user.interface';

/** Section eligibility is separate from each item's permission check. */
export function getMenuSectionAccess(user: Pick<ICurrentUser, 'roles'> | null | undefined) {
  const superAdministration = user?.roles.includes('SUPERADMIN') ?? false;

  return {
    superAdministration,

    // TEACHER is displayed as Docente, not a separate administrative persona.
    // DIRECTOR and custom roles are deliberately not inferred to be administrators.
    administration:
      superAdministration || (user?.roles.some((role) => role === 'ADMIN' || role === UserRole.DEAN) ?? false),
  };
}
