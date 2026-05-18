import { Module } from '@nestjs/common';
import { AuthController } from 'src/controllers/auth/auth.controller';
import { AuthService } from 'src/services/auth/auth.service';
import { UsersModule } from '../users/users.module';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from '@core/strategies/jwt/jwt.strategy';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: process.env.JWT_SECRET,
        signOptions: { expiresIn: '30m' },
      }),
    }),
    UsersModule,
    PassportModule,
    ConfigModule,
  ],
  providers: [AuthService, JwtStrategy],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
