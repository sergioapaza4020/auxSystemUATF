import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, ValidateIf } from 'class-validator';

export class UpdateOwnProfileDto {
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'Ingresa tus nombres.' })
  name?: string;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'Ingresa tus apellidos.' })
  lastname?: string;
}
