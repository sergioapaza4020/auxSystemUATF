import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { LoginDto } from 'src/dtos/auth/login.dto';

import * as bcrypt from 'bcrypt';
import { JwtPayload } from 'src/common/types/jwt-payload.type';
import { User } from 'src/entities/users/users.entity';
import { SessionsService } from '../sessions/sessions.service';
import { Request } from 'express';
import { UAParser } from 'ua-parser-js';
import { randomUUID } from 'node:crypto';
import { jwtDurationSeconds } from '@common/utils/jwt-duration';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly userService: UsersService,
    private readonly sessionService: SessionsService,
  ) {}

  async validateUser(loginDto: LoginDto): Promise<User> {
    const { username, password } = loginDto;

    const user = await this.userService.getForAuthentication(username);
    if (!user) throw new UnauthorizedException('User not found');

    const checkPassword = await bcrypt.compare(password, user.password);
    if (!checkPassword) throw new UnauthorizedException('Wrong password');

    Reflect.deleteProperty(user, 'password');
    return user;
  }

  async login(loginDto: LoginDto, request: Request) {
    const user = await this.validateUser(loginDto);

    const ipAddress = request.ip || request.socket.remoteAddress;
    const userAgent = request.headers['user-agent'];

    const parser = new UAParser(userAgent);
    const browser = parser.getBrowser().name;
    const os = parser.getOS().name;
    const device = parser.getDevice().type;

    const lastUsedAt = new Date();

    return this.sessionService.createSession({
      user,
      issueTokens: (idSession) => {
        const refreshToken = this.jwtService.sign(
          // Keep session entropy first: bcrypt compares only the first 72 bytes.
          { jti: randomUUID(), idUser: user.idUser, idSession },
          {
            secret: process.env.JWT_ACCESS_REFRESH,
            expiresIn: jwtDurationSeconds(
              process.env.JWT_ACCESS_REFRESH_EXPIRES_IN,
              'JWT_ACCESS_REFRESH_EXPIRES_IN',
            ),
          },
        );
        const accessToken = this.jwtService.sign(this.buildSessionPayload(user, idSession), {
          secret: process.env.JWT_ACCESS_SECRET,
          expiresIn: jwtDurationSeconds(
            process.env.JWT_ACCESS_SECRET_EXPIRES_IN,
            'JWT_ACCESS_SECRET_EXPIRES_IN',
          ),
        });
        return { accessToken, refreshToken };
      },
      ipAddress,
      userAgent,
      browser,
      os,
      device,
      lastUsedAt,
    });
  }

  decodeToken(token: string): JwtPayload | null {
    const decoded: unknown = this.jwtService.decode(token);
    if (!decoded || typeof decoded == 'string') return null;

    return decoded as JwtPayload;
  }

  private buildSessionPayload(user: User, idSession: number) {
    const roles = user.roles.map((r) => r.name);

    const permissions = [...new Set(user.roles.flatMap((r) => r.permissions.map((p) => p.name)))];

    return {
      idUser: user.idUser,
      idSession,
      name: user.name,
      username: user.username,
      email: user.email,
      roles,
      permissions,
    };
  }

  async getSession(idUser: number, idSession: number) {
    const user = await this.userService.getOneById(idUser);
    if (!user) throw new UnauthorizedException('User not found');

    return this.buildSessionPayload(user, idSession);
  }

  async refreshToken(token: string) {
    const refreshSecret = process.env.JWT_ACCESS_REFRESH;
    if (!refreshSecret) throw new Error('JWT_ACCESS_REFRESH is required');

    let payload: unknown;
    try {
      payload = this.jwtService.verify<object>(token, {
        secret: refreshSecret,
      });
    } catch (error) {
      if (
        error instanceof Error &&
        ['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError'].includes(error.name)
      ) {
        throw new UnauthorizedException('Invalid or expired refresh token');
      }
      throw error;
    }

    if (
      typeof payload !== 'object' ||
      payload === null ||
      !('idUser' in payload) ||
      typeof payload.idUser !== 'number' ||
      !Number.isSafeInteger(payload.idUser) ||
      payload.idUser <= 0
    ) {
      throw new UnauthorizedException('Invalid refresh token payload');
    }

    const idSession = 'idSession' in payload ? payload.idSession : undefined;
    if (
      idSession !== undefined &&
      (typeof idSession !== 'number' || !Number.isSafeInteger(idSession) || idSession <= 0)
    ) {
      throw new UnauthorizedException('Invalid refresh session identifier');
    }
    const session = await this.sessionService.validateRefreshToken(
      token,
      payload.idUser,
      idSession,
    );

    if (session.user.idUser !== payload.idUser) throw new UnauthorizedException('Invalid session');

    const newPayload = await this.getSession(payload.idUser, session.idSession);

    const newAccessToken = this.jwtService.sign(newPayload, {
      secret: process.env.JWT_ACCESS_SECRET,
      expiresIn: jwtDurationSeconds(
        process.env.JWT_ACCESS_SECRET_EXPIRES_IN,
        'JWT_ACCESS_SECRET_EXPIRES_IN',
      ),
    });

    await this.sessionService.updateLastSessionUsed(session);

    return { accessToken: newAccessToken };
  }
}
