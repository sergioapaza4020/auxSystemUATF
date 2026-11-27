import { ConflictException } from '@nestjs/common';

// A delayed request may be retried with a different browser session after refresh.
export function assertSameSession(expected: string | undefined, actual: number): void {
  if (expected !== String(actual)) {
    throw new ConflictException('Tu sesión cambió. Vuelve a abrir Configuración de cuenta.');
  }
}
