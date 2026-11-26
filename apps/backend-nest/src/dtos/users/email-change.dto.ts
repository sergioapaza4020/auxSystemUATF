import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

export class RequestEmailChangeDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'Ingresa un correo electrónico válido.' })
  @MaxLength(254)
  newEmail: string;

  @IsString()
  @IsNotEmpty({ message: 'Ingresa tu contraseña actual.' })
  @MaxLength(1024)
  currentPassword: string;
}

export class ConfirmEmailChangeDto {
  @IsString()
  @Matches(/^[a-zA-Z0-9_-]{43}$/, {
    message: 'Este enlace ya no está disponible. Solicita uno nuevo.',
  })
  token: string;
}
