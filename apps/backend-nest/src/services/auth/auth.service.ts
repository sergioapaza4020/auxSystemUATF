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
import { remainingSeconds, sessionDeadline } from '@common/utils/session-policy';
import { randomUUID } from 'node:crypto';
import { jwtDurationSeconds } from '@common/utils/jwt-duration';
import { CheckRegistrationDto } from 'src/dtos/auth/check-registration.dto';
import type { RegistrationCheck } from '@common/types/registration-check.type';
import type { ChangePasswordDto } from 'src/dtos/auth/change-password.dto';
import type { UpdateOwnProfileDto } from 'src/dtos/auth/update-own-profile.dto';
import { avatarVersion } from '@common/utils/avatar-key';

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
    if (!user) throw new UnauthorizedException('El usuario o la contraseña no son correctos.');

    const checkPassword = await bcrypt.compare(password, user.password);
    if (!checkPassword)
      throw new UnauthorizedException('El usuario o la contraseña no son correctos.');

    Reflect.deleteProperty(user, 'password');
    return user;
  }

  async checkRegistration(dto: CheckRegistrationDto): Promise<RegistrationCheck> {
    const user = await this.userService.getRegistrationByRu(dto.ru);
    if (!user) return { registered: false, status: 'NOT_FOUND' };
    return { registered: true, status: user.isActive ? 'ACTIVE' : 'INACTIVE' };
  }

  async login(loginDto: LoginDto, request: Request, secureTransport = false) {
    const user = await this.validateUser(loginDto);

    const ipAddress = request.ip || request.socket.remoteAddress;
    const userAgent = request.headers['user-agent'];

    const parser = new UAParser(userAgent);
    const browser = parser.getBrowser().name;
    const os = parser.getOS().name;
    const device = parser.getDevice().type;

    const lastUsedAt = new Date(Date.now());
    const rememberMe = secureTransport && loginDto.rememberMe === true;
    const expiresAt = sessionDeadline(rememberMe, lastUsedAt);

    return this.sessionService.createSession({
      user,
      rememberMe,
      expiresAt,
      issueTokens: (idSession) => {
        const { accessToken, refreshToken } = this.issueTokens(
          user,
          idSession,
          expiresAt,
          secureTransport,
        );
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

  private issueTokens(user: User, idSession: number, expiresAt: Date, secureTransport: boolean) {
    // jsonwebtoken derives exp from iat. Use the same second for both tokens and the TTL cap.
    const iat = Math.floor(Date.now() / 1000);
    const remaining = remainingSeconds(expiresAt, iat);
    const accessSeconds = jwtDurationSeconds(
      process.env.JWT_ACCESS_SECRET_EXPIRES_IN,
      'JWT_ACCESS_SECRET_EXPIRES_IN',
    );
    const accessToken = this.jwtService.sign(
      { ...this.buildSessionPayload(user, idSession), iat },
      {
        secret: process.env.JWT_ACCESS_SECRET,
        algorithm: 'HS256',
        expiresIn: Math.min(accessSeconds, remaining),
      },
    );
    const refreshToken = this.jwtService.sign(
      {
        jti: randomUUID(),
        idUser: user.idUser,
        idSession,
        transport: secureTransport ? 'http-only-v1' : 'legacy',
        iat,
      },
      {
        secret: process.env.JWT_ACCESS_REFRESH,
        algorithm: 'HS256',
        expiresIn: remaining,
      },
    );
    return { accessToken, refreshToken };
  }

  private buildSessionPayload(user: User, idSession: number) {
    const roles = user.roles.filter((r) => r.isActive !== false).map((r) => r.name);

    const permissions = [
      ...new Set(
        user.roles
          .filter((r) => r.isActive !== false)
          .flatMap((r) => r.permissions.filter((p) => p.isActive !== false).map((p) => p.name)),
      ),
    ];

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
    const user = await this.getActiveAccount(idUser);
    return this.buildSessionPayload(user, idSession);
  }

  async getProfile(idUser: number, idSession: number) {
    const user = await this.getActiveAccount(idUser);
    return {
      ...this.buildSessionPayload(user, idSession),
      lastname: user.lastname,
      avatarVersion: avatarVersion(user.idUser, user.avatar),
      ci: user.ci ?? null,
      ru: user.ru ?? null,
    };
  }

  updateProfile(idUser: number, dto: UpdateOwnProfileDto) {
    return this.userService.updateOwnProfile(idUser, dto);
  }

  changePassword(user: JwtPayload, dto: ChangePasswordDto) {
    return this.userService.changeOwnPassword(user.idUser, user.idSession, dto);
  }

  private async getActiveAccount(idUser: number) {
    const user = await this.userService.getOneById(idUser);
    if (!user)
      throw new UnauthorizedException('Tu sesión ya no es válida. Inicia sesión nuevamente.');

    return user;
  }

  async refreshToken(token: string, rotate = false) {
    const refreshSecret = process.env.JWT_ACCESS_REFRESH;
    if (!refreshSecret) throw new Error('JWT_ACCESS_REFRESH is required');

    let payload: unknown;
    try {
      payload = this.jwtService.verify<object>(token, {
        secret: refreshSecret,
        algorithms: ['HS256'],
      });
    } catch (error) {
      if (
        error instanceof Error &&
        ['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError'].includes(error.name)
      ) {
        throw new UnauthorizedException('Tu sesión ya no es válida. Inicia sesión nuevamente.');
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
      throw new UnauthorizedException('Tu sesión ya no es válida. Inicia sesión nuevamente.');
    }

    if (!rotate && 'transport' in payload && payload.transport === 'http-only-v1') {
      throw new UnauthorizedException('Vuelve a iniciar sesión para renovar el acceso.');
    }

    const idSession = 'idSession' in payload ? payload.idSession : undefined;
    if (
      idSession !== undefined &&
      (typeof idSession !== 'number' || !Number.isSafeInteger(idSession) || idSession <= 0)
    ) {
      throw new UnauthorizedException('Tu sesión ya no es válida. Inicia sesión nuevamente.');
    }
    const session = await this.sessionService.validateRefreshToken(
      token,
      payload.idUser,
      idSession,
    );

    if (session.user.idUser !== payload.idUser)
      throw new UnauthorizedException('Tu sesión ya no es válida. Inicia sesión nuevamente.');

    const newPayload = await this.getSession(payload.idUser, session.idSession);
    if (
      session.refreshToken.startsWith('sha256:v1:') &&
      (!('jti' in payload) || typeof payload.jti !== 'string' || !payload.jti)
    ) {
      throw new UnauthorizedException('Tu sesión ya no es válida. Inicia sesión nuevamente.');
    }
    const absolute = session.expiresAt;
    const tokenExpiry =
      'exp' in payload && typeof payload.exp === 'number' ? new Date(payload.exp * 1000) : absolute;
    const effectiveExpiry = new Date(Math.min(absolute.getTime(), tokenExpiry.getTime()));
    if (rotate) {
      const user = await this.userService.getOneById(payload.idUser);
      if (!user)
        throw new UnauthorizedException('Tu sesión ya no es válida. Inicia sesión nuevamente.');
      const next = this.issueTokens(user, session.idSession, effectiveExpiry, true);
      await this.sessionService.rotateRefresh(session, session.refreshToken, next.refreshToken);
      return {
        ...next,
        sessionExpiresAt: effectiveExpiry.toISOString(),
        rememberMe: session.rememberMe ?? null,
      };
    }
    // Bounded compatibility for old clients: never grant persistent 30-day sessions.
    const iat = Math.floor(Date.now() / 1000);
    const accessToken = this.jwtService.sign(
      { ...newPayload, iat },
      {
        secret: process.env.JWT_ACCESS_SECRET,
        expiresIn: Math.min(
          jwtDurationSeconds(
            process.env.JWT_ACCESS_SECRET_EXPIRES_IN,
            'JWT_ACCESS_SECRET_EXPIRES_IN',
          ),
          remainingSeconds(effectiveExpiry, iat),
        ),
      },
    );
    await this.sessionService.updateLastSessionUsed(session);
    return { accessToken };
  }

  /** Logout accepts a signed session proof even after rotation: a racing refresh cannot defeat logout. */
  async logoutSecure(token: string): Promise<void> {
    let payload: { idUser: number; idSession?: number };
    try {
      payload = this.jwtService.verify(token, {
        secret: process.env.JWT_ACCESS_REFRESH,
        algorithms: ['HS256'],
      });
    } catch {
      throw new UnauthorizedException('No pudimos verificar tu sesión para cerrarla.');
    }
    if (!Number.isSafeInteger(payload.idUser) || payload.idUser <= 0)
      throw new UnauthorizedException();
    if (payload.idSession !== undefined) {
      if (!Number.isSafeInteger(payload.idSession) || payload.idSession <= 0)
        throw new UnauthorizedException();
      await this.sessionService.logoutByIdentity(payload.idSession, payload.idUser);
    } else {
      const session = await this.sessionService.validateRefreshToken(token, payload.idUser);
      await this.sessionService.logoutByIdentity(session.idSession, payload.idUser);
    }
  }
}
