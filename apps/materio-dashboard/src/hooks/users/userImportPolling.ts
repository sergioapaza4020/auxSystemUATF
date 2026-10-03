import type { IUserImportExecution, UserImportExecutionStatus } from '@/interfaces/users/user-import.interface';

export const isImportTerminal = (status: UserImportExecutionStatus) =>
  ['COMPLETED', 'COMPLETED_WITH_ERRORS', 'FAILED', 'EXPIRED'].includes(status);

/** Schedule after completion, so slow requests cannot overlap. */
export function pollUserImport(
  fetchStatus: (signal: AbortSignal) => Promise<IUserImportExecution>,
  onStatus: (value: IUserImportExecution) => void,
  onError: (error: unknown) => void,
  delay = 2000,
) {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;

  const tick = async () => {
    let terminal = false;

    try {
      const status = await fetchStatus(controller.signal);

      if (controller.signal.aborted) return;
      onStatus(status);
      terminal = isImportTerminal(status.status);
    } catch (error) {
      if (!controller.signal.aborted) onError(error);
    } finally {
      if (!controller.signal.aborted && !terminal) timer = setTimeout(() => void tick(), delay);
    }
  };

  void tick();

  return () => {
    controller.abort();
    if (timer) clearTimeout(timer);
  };
}
