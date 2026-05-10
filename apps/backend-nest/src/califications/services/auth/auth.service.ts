import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { LoginDto } from 'src/califications/dtos/auth/login.dto';

import * as bcrypt from 'bcrypt';
import { JwtPayload } from 'src/types/jwt-payload.type';
import { User } from 'src/califications/entities/users/users.entity';

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

    const roles = user.roles.map((r) => r.name);

    const permissions = [
      ...new Set(user.roles.flatMap((r) => r.permissions.map((p) => p.name))),
    ];

    const payload: JwtPayload = {
      idUser: user.idUser,
      username: user.username,
      email: user.email,
      roles,
      permissions,
    };

    const accessToken = this.jwtService.sign(payload, { expiresIn: '4h' });

    return {
      user,
      accessToken,
    };
  }

  decodeToken(token: string): JwtPayload | null {
    const decoded: unknown = this.jwtService.decode(token);
    if (!decoded || typeof decoded == 'string') return null;

    return decoded as JwtPayload;
  }
}
