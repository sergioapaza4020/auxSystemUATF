import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from 'src/common/types/jwt-payload.type';
import { SessionsService } from 'src/services/sessions/sessions.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly sessions: SessionsService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_ACCESS_SECRET!,
    });
  }

  async validate(payload: JwtPayload) {
    if (
      !payload ||
      !Number.isSafeInteger(payload.idSession) ||
      payload.idSession <= 0 ||
      !Number.isSafeInteger(payload.idUser) ||
      payload.idUser <= 0
    ) {
      throw new UnauthorizedException('Invalid access session identifier');
    }
    await this.sessions.assertActiveSession(payload.idSession, payload.idUser);
    return payload;
  }
}
