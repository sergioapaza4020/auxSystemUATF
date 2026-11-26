import { UserSession } from 'src/entities/user-sessions/user-sessions.entity';

/** Explicit allowlist: never expose a session entity or its credential digest. */
export function sessionResponse(session: UserSession) {
  return {
    idSession: session.idSession,
    user: session.user
      ? {
          idUser: session.user.idUser,
          username: session.user.username,
          name: session.user.name,
          lastname: session.user.lastname,
        }
      : undefined,
    browser: session.browser,
    os: session.os,
    device: session.device,
    ipAddress: session.ipAddress,
    userAgent: session.userAgent,
    createdAt: session.createdAt,
    expiresAt: session.expiresAt,
    lastUsedAt: session.lastUsedAt,
    isActive: session.isActive,
    revokedAt: session.revokedAt,
    revokedReason: session.revokedReason,
    rememberMe: session.rememberMe,
  };
}
