import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { LoginDto } from 'src/dtos/auth/login.dto';

import * as bcrypt from 'bcrypt';
import { JwtPayload } from 'src/common/types/jwt-payload.type';
import { User } from 'src/entities/users/users.entity';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(loginDto: LoginDto): Promise<User> {
    const { username, password } = loginDto;

    const user = await this.userService.getOneByUsername(username);
    if (!user) throw new UnauthorizedException('User not found');

    const checkPassword = await bcrypt.compare(password, user.password);
    if (!checkPassword) throw new UnauthorizedException('Wrong password');

    return user;
  }

  async login(loginDto: LoginDto) {
    const user = await this.validateUser(loginDto);

    const session = this.buildSessionPayload(user);

    const accessToken = this.jwtService.sign(session, {
      secret: process.env.JWT_ACCESS_SECRET,
      expiresIn: process.env.JWT_ACCESS_SECRET_EXPIRES_IN as number | undefined,
    });

    const refreshToken = this.jwtService.sign(
      { idUser: user.idUser },
      {
        secret: process.env.JWT_ACCESS_REFRESH,
        expiresIn: process.env.JWT_ACCESS_REFRESH_EXPIRES_IN as
          | number
          | undefined,
      },
    );
    return {
      session,
      accessToken,
      refreshToken,
    };
  }

  decodeToken(token: string): JwtPayload | null {
    const decoded: unknown = this.jwtService.decode(token);
    if (!decoded || typeof decoded == 'string') return null;

    return decoded as JwtPayload;
  }

  private buildSessionPayload(user: User) {
    const roles = user.roles.map((r) => r.name);

    const permissions = [
      ...new Set(user.roles.flatMap((r) => r.permissions.map((p) => p.name))),
    ];

    return {
      idUser: user.idUser,
      username: user.username,
      email: user.email,
      roles,
      permissions,
    };
  }

  async getSession(userId: number) {
    const user = await this.userService.getOneById(userId);
    if (!user) throw new UnauthorizedException('User not found');

    return this.buildSessionPayload(user);
  }

  async refreshToken(token: string) {
    try {
      const payload = this.jwtService.verify<JwtPayload>(token, {
        secret: process.env.JWT_ACCESS_REFRESH,
      });

      const session = await this.getSession(payload.idUser);

      const newAccessToken = this.jwtService.sign(session, {
        secret: process.env.JWT_ACCESS_REFRESH,
        expiresIn: process.env.JWT_ACCESS_SECRET_EXPIRES_IN as
          | number
          | undefined,
      });

      return { accessToken: newAccessToken };
    } catch (error) {
      throw new UnauthorizedException(
        `Invalid refresh token: ${(error as Error).message}`,
      );
    }
  }
}
