/** Keep date-only deadlines unchanged; display publication instants in the academic timezone. */
export function formatActivityPublication(publishedAt: string): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/La_Paz' }).format(new Date(publishedAt));
}
