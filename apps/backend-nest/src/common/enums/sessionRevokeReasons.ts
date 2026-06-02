export enum SessionRevokeReasons {
  LOGOUT = 'Session closed by user',
  LOGOUT_ALL = 'Session closed on all devices',
  PASSWORD_CHANGED = 'Password changed',
  SUSPICIOUS_ACTIVITY = 'Suspicious activity detected',
  ADMIN_ACTION = 'Session revoked by an administrator',
  EXPIRED = 'Session expired',
}
