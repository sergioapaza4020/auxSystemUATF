import { ForbiddenException } from '@nestjs/common';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';
import { Reflector } from '@nestjs/core';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PermissionsGuard } from '@core/guards/permissions/permissions.guard';
import { EnrollmentImportTargetDto } from 'src/dtos/enrollments/enrollment-import.dto';
import { EnrollmentImportController } from './enrollment-import.controller';

describe('Enrollment import authorization and target', () => {
  const guard = new PermissionsGuard(new Reflector());
  it.each(['template', 'preview', 'import'] as const)(
    'protects %s with enrollment.create and SUPERADMIN bypass',
    (method) => {
      const context = (roles: string[], permissions: string[]) =>
        new ExecutionContextHost(
          [{ user: { roles, permissions } }],
          EnrollmentImportController,
          EnrollmentImportController.prototype[method],
        );
      expect(() => guard.canActivate(context(['ADMIN'], []))).toThrow(ForbiddenException);
      expect(guard.canActivate(context(['ADMIN'], ['enrollment.create']))).toBe(true);
      expect(guard.canActivate(context(['SUPERADMIN'], []))).toBe(true);
    },
  );
  it('accepts numeric multipart identifiers and rejects missing/non-positive/fractional IDs', async () => {
    const good = plainToInstance(EnrollmentImportTargetDto, { courseId: '10', semesterId: '20' });
    expect(await validate(good)).toHaveLength(0);
    expect(good.courseId).toBe(10);
    for (const data of [
      {},
      { courseId: 0, semesterId: 1 },
      { courseId: 1, semesterId: 1.5 },
      { courseId: 'bad', semesterId: 2 },
    ]) {
      expect(
        (await validate(plainToInstance(EnrollmentImportTargetDto, data))).length,
      ).toBeGreaterThan(0);
    }
  });
});
