import { Module } from '@nestjs/common';
import { AuthController } from 'src/controllers/auth/auth.controller';
import { AuthService } from 'src/services/auth/auth.service';
import { UsersModule } from '../users/users.module';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from '@core/strategies/jwt/jwt.strategy';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SessionsModule } from '../sessions/sessions.module';
import { jwtDurationSeconds } from '@common/utils/jwt-duration';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const expiresIn = jwtDurationSeconds(
          config.get<string>('JWT_ACCESS_SECRET_EXPIRES_IN'),
          'JWT_ACCESS_SECRET_EXPIRES_IN',
        );
        jwtDurationSeconds(
          config.get<string>('JWT_ACCESS_REFRESH_EXPIRES_IN'),
          'JWT_ACCESS_REFRESH_EXPIRES_IN',
        );
        return { secret: config.get<string>('JWT_ACCESS_SECRET'), signOptions: { expiresIn } };
      },
    }),
    PassportModule,
    ConfigModule,
    UsersModule,
    SessionsModule,
  ],
  providers: [AuthService, JwtStrategy],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
