import { BadRequestException } from '@nestjs/common';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import type {
  AttendanceImportChoice,
  AttendanceImportOptions,
} from 'src/services/attendances/attendance-import.service';

export class AttendanceImportDto {
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  options?: string;

  static parse(value?: string): AttendanceImportOptions {
    if (value === undefined) return { choices: [], updateExisting: false };
    const invalid = () =>
      new BadRequestException('Las decisiones de importación tienen un formato inválido');
    let data: unknown;
    try {
      data = JSON.parse(value);
    } catch {
      throw invalid();
    }
    if (
      !data ||
      typeof data !== 'object' ||
      !('choices' in data) ||
      !Array.isArray(data.choices) ||
      data.choices.length > 100 ||
      !('updateExisting' in data) ||
      typeof data.updateExisting !== 'boolean'
    )
      throw invalid();
    const seen = new Set<string>();
    const choices = data.choices.map((choice: unknown): AttendanceImportChoice => {
      if (
        !choice ||
        typeof choice !== 'object' ||
        !('column' in choice) ||
        typeof choice.column !== 'string' ||
        !/^[A-Z]{1,2}$/.test(choice.column) ||
        seen.has(choice.column) ||
        !('sessionId' in choice) ||
        (choice.sessionId !== 'create' &&
          (typeof choice.sessionId !== 'number' ||
            !Number.isSafeInteger(choice.sessionId) ||
            choice.sessionId < 1))
      )
        throw invalid();
      seen.add(choice.column);
      return { column: choice.column, sessionId: choice.sessionId };
    });
    return { choices, updateExisting: data.updateExisting };
  }
}
