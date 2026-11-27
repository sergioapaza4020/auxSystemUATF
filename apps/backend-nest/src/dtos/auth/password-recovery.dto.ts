import { Transform } from 'class-transformer';
import { IsEmail, IsString, IsUUID, Matches, MaxLength } from 'class-validator';

export class RequestRecoveryDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(254)
  email: string;
}

export class VerifyRecoveryDto {
  @IsUUID('4')
  id: string;

  @IsString()
  @Matches(/^\d{6}$/)
  code: string;
}

export class ResetRecoveryDto {
  @IsUUID('4')
  id: string;

  @IsString()
  @Matches(/^[0-9a-f]{64}$/)
  proof: string;

  @IsString()
  @MaxLength(72)
  password: string;
}
