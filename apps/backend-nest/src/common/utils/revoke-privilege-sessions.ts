import { EntityManager } from 'typeorm';
import { SessionRevokeReasons } from '@common/enums/sessionRevokeReasons';

export async function revokePrivilegeSessions(
  manager: EntityManager,
  kind: 'role' | 'permission',
  id: number,
) {
  const members =
    kind === 'role'
      ? 'SELECT "usersIdUser" FROM user_role WHERE "rolesIdRole" = $1'
      : 'SELECT ur."usersIdUser" FROM user_role ur JOIN role_permission rp ON rp."rolesIdRole" = ur."rolesIdRole" WHERE rp."permissionsIdPermission" = $1';
  await manager.query(
    `UPDATE user_sessions SET is_active = false, revoked_at = CURRENT_TIMESTAMP,
    revoked_reason = $2 WHERE is_active = true AND id_user IN (${members})`,
    [id, SessionRevokeReasons.ADMIN_ACTION],
  );
}
