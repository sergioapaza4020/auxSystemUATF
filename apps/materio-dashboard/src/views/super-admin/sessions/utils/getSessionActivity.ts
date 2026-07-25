import moment from 'moment';

export function getSessionActivity(lastUsedAt: Date | null, isActive: boolean): string {
  if (!lastUsedAt) {
    return 'Nunca';
  }

  const lastActivity = new Date(lastUsedAt);
  const isOnline = Date.now() - lastActivity.getTime() < 15 * 60 * 1000;

  return isOnline && isActive ? 'En línea' : moment(lastUsedAt).format('DD/MM/YYYY HH:mm');
}
