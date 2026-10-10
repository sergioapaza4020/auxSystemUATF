import axios from 'axios';

export function getApiErrorMessage(error: unknown): string {
  if (!axios.isAxiosError(error))
    return error instanceof Error && error.message ? error.message : 'Ha ocurrido un error inesperado';

  const data = error.response?.data;

  if (typeof data?.message === 'string') return data.message;

  if (Array.isArray(data?.message)) return data.message.join('\n');

  return data?.error ?? 'Ha ocurrido un error inesperado';
}
