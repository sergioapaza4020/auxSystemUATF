import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { UserSession } from 'src/entities/user-sessions/user-sessions.entity';
import { User } from 'src/entities/users/users.entity';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { SessionRevokeReasons } from '@common/enums/sessionRevokeReasons';

@Injectable()
export class SessionsService {
  constructor(
    @InjectRepository(UserSession)
    private readonly sessionRepository: Repository<UserSession>,
  ) {}

  async createSession(params: {
    user: User;
    refreshToken: string;
    userAgent?: string;
    ipAddress?: string;
  }): Promise<UserSession> {
    const hashedRefreshToken = await bcrypt.hash(params.refreshToken, 10);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const session = this.sessionRepository.create({
      user: params.user,
      refreshToken: hashedRefreshToken,
      userAgent: params.userAgent,
      ipAddress: params.ipAddress,
      expiresAt,
    });

    return this.sessionRepository.save(session);
  }

  async getUserSessions(idUser: number): Promise<UserSession[]> {
    return this.sessionRepository.find({
      where: {
        user: { idUser },
        isActive: true,
      },
      relations: ['users'],
      order: { createdAt: 'DESC' },
    });
  }

  async findActiveSessionByUser(idUser: number): Promise<UserSession | null> {
    return this.sessionRepository.findOne({
      where: {
        user: { idUser },
        isActive: true,
      },
      relations: ['users'],
      order: { createdAt: 'DESC' },
    });
  }

  async validateRefreshToken(refreshToken: string): Promise<UserSession> {
    const sessions = await this.sessionRepository.find({
      where: {
        isActive: true,
      },
      relations: ['users'],
    });

    for (const session of sessions) {
      const isMatch = await bcrypt.compare(refreshToken, session.refreshToken);
      if (isMatch) {
        return session;
      }
    }

    throw new UnauthorizedException('Refresh token inválido');
  }

  async updateLastSessionUsed(session: UserSession): Promise<UserSession> {
    session.lastUsedAt = new Date();

    return this.sessionRepository.save(session);
  }

  async revokeSession(
    session: UserSession,
    revokedBy?: User,
  ): Promise<UserSession> {
    session.isActive = false;

    session.revokedAt = new Date();
    session.revokedReason = SessionRevokeReasons.LOGOUT;

    if (revokedBy) session.revokedBy = revokedBy;

    return this.sessionRepository.save(session);
  }

  async revokeSessionById(
    idSession: number,
    revokedBy?: User,
  ): Promise<UserSession> {
    const session = await this.sessionRepository.findOne({
      where: { idSession },
      relations: ['users'],
    });
    if (!session) throw new NotFoundException('Sesión no encontrada');

    session.isActive = false;
    session.revokedAt = new Date();
    session.revokedReason = SessionRevokeReasons.ADMIN_ACTION;

    if (revokedBy) session.revokedBy = revokedBy;

    return this.sessionRepository.save(session);
  }

  async revokeAllSessions(idUser: number, revokedBy?: User): Promise<void> {
    const sessions = await this.sessionRepository.find({
      where: {
        user: { idUser },
        isActive: true,
      },
      relations: ['users'],
    });

    for (const session of sessions) {
      session.isActive = false;
      session.revokedAt = new Date();
      session.revokedReason = SessionRevokeReasons.LOGOUT_ALL;

      if (revokedBy) session.revokedBy = revokedBy;

      await this.sessionRepository.save(session);
    }
  }
}
