import { BadRequestException } from '@nestjs/common';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import type { ColumnChoice } from 'src/services/grades/grade-import.service';

export class GradeImportPreviewDto {
  @IsOptional()
  @IsString()
  @MaxLength(16000)
  options?: string;

  static parse(input?: string): { choices: ColumnChoice[]; updateExisting: boolean } {
    const invalid = () =>
      new BadRequestException('Las decisiones de importación tienen un formato inválido');
    if (input === undefined) return { choices: [], updateExisting: false };
    let data: unknown;
    try {
      data = JSON.parse(input);
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
    const choices = data.choices.map((choice: unknown): ColumnChoice => {
      if (
        !choice ||
        typeof choice !== 'object' ||
        !('column' in choice) ||
        typeof choice.column !== 'string' ||
        !/^[A-Z]{1,2}$/.test(choice.column) ||
        seen.has(choice.column)
      )
        throw invalid();
      const activityId = 'activityId' in choice ? choice.activityId : undefined;
      const detailId = 'detailId' in choice ? choice.detailId : undefined;
      const acceptDate = 'acceptDate' in choice ? choice.acceptDate : false;
      const validId = (value: unknown): value is number =>
        typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
      if (
        (activityId !== undefined && !validId(activityId)) ||
        (detailId !== undefined && !validId(detailId)) ||
        (activityId !== undefined && detailId !== undefined) ||
        typeof acceptDate !== 'boolean'
      )
        throw invalid();
      seen.add(choice.column);
      return { column: choice.column, activityId, detailId, acceptDate };
    });
    return { choices, updateExisting: data.updateExisting };
  }
}
