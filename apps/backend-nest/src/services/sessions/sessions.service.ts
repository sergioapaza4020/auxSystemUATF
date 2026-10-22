import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { UserSession } from 'src/entities/user-sessions/user-sessions.entity';
import { User } from 'src/entities/users/users.entity';
import { MoreThan, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { SessionRevokeReasons } from '@common/enums/sessionRevokeReasons';
import { SessionQueryDto } from 'src/dtos/sessions/session-query.dto';
import { normalizeIp } from '@common/utils/normalize-ip';

@Injectable()
export class SessionsService {
  constructor(
    @InjectRepository(UserSession)
    private readonly sessionRepository: Repository<UserSession>,
  ) {}

  async createSession(params: {
    user: User;
    issueTokens: (idSession: number) => { accessToken: string; refreshToken: string };
    ipAddress?: string;
    userAgent?: string;
    browser?: string;
    os?: string;
    device?: string;
    lastUsedAt: Date;
  }) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    return this.sessionRepository.manager.transaction(async (manager) => {
      const repository = manager.getRepository(UserSession);
      const session = await repository.save(
        repository.create({
          user: params.user,
          // Only visible inside this transaction until tokens and their hash are ready.
          isActive: false,
          refreshToken: '',
          ipAddress: normalizeIp(params.ipAddress),
          userAgent: params.userAgent,
          browser: params.browser,
          os: params.os,
          device: params.device,
          lastUsedAt: params.lastUsedAt,
          expiresAt,
        }),
      );
      const tokens = params.issueTokens(session.idSession);
      session.refreshToken = await bcrypt.hash(tokens.refreshToken, 10);
      session.isActive = true;
      const userSession = await repository.save(session);
      return { ...tokens, userSession };
    });
  }

  async assertActiveSession(idSession: number, idUser: number): Promise<void> {
    const active = await this.sessionRepository
      .createQueryBuilder('session')
      .where(
        'session.id_session = :idSession AND session.id_user = :idUser ' +
          'AND session.is_active = true AND session.expires_at > :now',
        { idSession, idUser, now: new Date() },
      )
      .getExists();
    if (!active) throw new UnauthorizedException('Session is no longer active');
  }

  async getAllSessions(query: SessionQueryDto) {
    const { page = 1, limit = 20 } = query;
    const [data, total] = await this.sessionRepository
      .createQueryBuilder('session')
      .leftJoinAndSelect('session.user', 'user')
      .orderBy('session.isActive', 'DESC')
      .addOrderBy('session.lastUsedAt', 'DESC', 'NULLS LAST')
      .addOrderBy('session.idSession', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getUserSessions(idUser: number): Promise<UserSession[]> {
    return this.sessionRepository
      .createQueryBuilder('session')
      .leftJoinAndSelect('session.user', 'user')
      .where('user.id_user = :idUser', { idUser })
      .orderBy('session.isActive', 'DESC')
      .addOrderBy('session.lastUsedAt', 'DESC', 'NULLS LAST')
      .getMany();
  }

  async findActiveSessionByUser(idUser: number): Promise<UserSession | null> {
    return this.sessionRepository.findOne({
      where: {
        user: { idUser },
        isActive: true,
      },
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });
  }

  async validateRefreshToken(
    refreshToken: string,
    idUser?: number,
    idSession?: number,
  ): Promise<UserSession> {
    const now = new Date();
    const options = {
      where: {
        isActive: true,
        expiresAt: MoreThan(now),
        ...(idUser === undefined ? {} : { user: { idUser } }),
        ...(idSession === undefined ? {} : { idSession }),
      },
      relations: ['user'],
    };
    const selected =
      idSession === undefined ? undefined : await this.sessionRepository.findOne(options);
    const sessions =
      idSession === undefined
        ? await this.sessionRepository.find(options)
        : selected
          ? [selected]
          : [];

    for (const session of sessions) {
      if (
        !session.isActive ||
        !(session.expiresAt > now) ||
        (idSession !== undefined && session.idSession !== idSession) ||
        (idUser !== undefined && session.user.idUser !== idUser)
      ) {
        continue;
      }
      const isMatch = await bcrypt.compare(refreshToken, session.refreshToken);
      if (isMatch) {
        return session;
      }
    }

    throw new UnauthorizedException('Invalid token refresh');
  }

  async updateLastSessionUsed(session: UserSession): Promise<UserSession> {
    const now = new Date();
    // Never save a stale entity here: it could reactivate a remotely revoked session.
    const result = await this.sessionRepository.update(
      { idSession: session.idSession, isActive: true, expiresAt: MoreThan(now) },
      { lastUsedAt: now },
    );
    if (!result.affected) throw new UnauthorizedException('Session is no longer active');

    session.lastUsedAt = now;
    return session;
  }

  async revokeSession(session: UserSession, revokedBy?: User): Promise<UserSession> {
    session.isActive = false;

    session.revokedAt = new Date();
    session.revokedReason = SessionRevokeReasons.LOGOUT;

    if (revokedBy) session.revokedBy = revokedBy;

    return this.sessionRepository.save(session);
  }

  async revokeSessionById(
    idSession: number,
    revokedBy?: Pick<User, 'idUser'>,
  ): Promise<UserSession> {
    const session = await this.sessionRepository.findOne({
      where: { idSession },
      relations: ['user'],
    });
    if (!session) throw new NotFoundException('Session not found');
    if (!session.isActive) return session;

    session.isActive = false;
    session.revokedAt = new Date();
    session.revokedReason = SessionRevokeReasons.ADMIN_ACTION;

    if (revokedBy) session.revokedBy = Object.assign(new User(), revokedBy);

    return this.sessionRepository.save(session);
  }

  async revokeAllSessions(idUser: number, revokedBy?: User): Promise<void> {
    const sessions = await this.sessionRepository.find({
      where: {
        user: { idUser },
        isActive: true,
      },
      relations: ['user'],
    });

    for (const session of sessions) {
      session.isActive = false;
      session.revokedAt = new Date();
      session.revokedReason = SessionRevokeReasons.LOGOUT_ALL;

      if (revokedBy) session.revokedBy = revokedBy;

      await this.sessionRepository.save(session);
    }
  }

  async logout(refreshToken: string, revokedBy?: Pick<User, 'idUser'> & { idSession?: number }) {
    const session = await this.validateRefreshToken(
      refreshToken,
      revokedBy?.idUser,
      revokedBy?.idSession,
    );

    return this.revokeSession(
      session,
      revokedBy ? Object.assign(new User(), { idUser: revokedBy.idUser }) : undefined,
    );
  }
}
