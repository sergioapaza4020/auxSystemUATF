import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UserImportRowDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  lastname: string;

  @IsString()
  @IsNotEmpty()
  ci: string;

  @IsOptional()
  @IsString()
  ru?: string;

  @IsEmail()
  email: string;
}
