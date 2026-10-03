import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PermissionsGuard } from '@core/guards/permissions/permissions.guard';
import { CareerStudentImportParamsDto } from 'src/dtos/careers/career-student-import.dto';
import { CareerStudentImportController } from './career-student-import.controller';

describe('Career student import authorization', () => {
  const guard = new PermissionsGuard(new Reflector());
  it.each(['template', 'preview', 'import'] as const)(
    'requires career.update for %s, with SUPERADMIN bypass',
    (method) => {
      const context = (roles: string[], permissions: string[]) =>
        new ExecutionContextHost(
          [{ user: { roles, permissions } }],
          CareerStudentImportController,
          CareerStudentImportController.prototype[method],
        );
      expect(() => guard.canActivate(context(['DIRECTOR'], []))).toThrow(ForbiddenException);
      expect(() => guard.canActivate(context(['ADMIN'], ['user.update']))).toThrow(
        ForbiddenException,
      );
      expect(guard.canActivate(context(['ADMIN'], ['career.update']))).toBe(true);
      expect(guard.canActivate(context(['DIRECTOR'], ['career.update']))).toBe(true);
      expect(guard.canActivate(context(['SUPERADMIN'], []))).toBe(true);
    },
  );
  it('validates positive database integer route identifiers', async () => {
    expect(
      await validate(plainToInstance(CareerStudentImportParamsDto, { careerId: '10' })),
    ).toHaveLength(0);
    for (const careerId of [undefined, '', 'bad', 0, -1, 1.5, 2147483648]) {
      expect(
        (await validate(plainToInstance(CareerStudentImportParamsDto, { careerId }))).length,
      ).toBeGreaterThan(0);
    }
  });
});
