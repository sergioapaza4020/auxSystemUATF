import {
  BadRequestException,
  ConflictException,
  GoneException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'node:crypto';
import { EntityManager, IsNull, MoreThan, Not, QueryFailedError, Repository } from 'typeorm';
import { SessionRevokeReasons } from '@common/enums/sessionRevokeReasons';
import type { JwtPayload } from '@common/types/jwt-payload.type';
import type { RequestEmailChangeDto } from 'src/dtos/users/email-change.dto';
import { EmailChangeRequest } from 'src/entities/email-change-requests/email-change-request.entity';
import { User } from 'src/entities/users/users.entity';
import { UserSession } from 'src/entities/user-sessions/user-sessions.entity';
import { MailService } from '../mail/mail.service';
import { emailChangeNotice, verificationEmail } from '@core/mail/institutional-email';

const minute = 60_000;
const unavailableMessage = 'Este enlace ya no está disponible. Solicita uno nuevo.';

function digest(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class EmailChangeService {
  private readonly logger = new Logger(EmailChangeService.name);

  constructor(
    @InjectRepository(EmailChangeRequest) private readonly requests: Repository<EmailChangeRequest>,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  async pending(actor: JwtPayload) {
    const pending = await this.requests
      .createQueryBuilder('request')
      .innerJoin(
        UserSession,
        'origin',
        'origin.idSession = request.idSession AND origin.isActive = true AND origin.expiresAt > :now',
      )
      .innerJoin('request.user', 'account', 'account.email = request.oldEmail')
      .where(
        'request.idUser = :idUser AND request.expiresAt > :now AND request.consumedAt IS NULL AND request.invalidatedAt IS NULL',
        {
          idUser: actor.idUser,
          now: new Date(),
        },
      )
      .getOne();
    return pending ? { newEmail: pending.newEmail, expiresAt: pending.expiresAt } : null;
  }

  async request(actor: JwtPayload, dto: RequestEmailChangeDto) {
    this.mail.assertConfigured();
    const token = randomBytes(32).toString('base64url');
    const link = this.verificationLink(token);
    const account = await this.requests.manager.getRepository(User).findOne({
      where: { idUser: actor.idUser, isActive: true },
      select: { idUser: true, password: true },
    });
    if (!account || !(await bcrypt.compare(dto.currentPassword, account.password))) {
      throw new BadRequestException('La contraseña actual no es correcta.');
    }

    const pending = await this.requests.manager.transaction(async (manager) => {
      // Serialize budget reservations across API instances. The lock is released before sending.
      await manager.query('SELECT pg_advisory_xact_lock($1, $2)', [637102, 1]);
      const users = manager.getRepository(User);
      const user = await users.findOne({
        where: { idUser: actor.idUser, isActive: true },
        select: { idUser: true, email: true, password: true },
        lock: { mode: 'pessimistic_write' },
      });
      if (
        !user ||
        user.password !== account.password ||
        !(await this.activeSessions(manager, actor))
      ) {
        throw new UnauthorizedException('Tu sesión ya no está activa.');
      }
      if (user.email.toLowerCase() === dto.newEmail) {
        throw new BadRequestException('Ingresa un correo diferente al actual.');
      }
      await this.assertEmailAvailable(users, dto.newEmail, actor.idUser);
      const now = new Date();
      const recent = MoreThan(new Date(now.getTime() - 60 * minute));
      const requests = manager.getRepository(EmailChangeRequest);
      if (
        (await requests.existsBy({
          idUser: actor.idUser,
          createdAt: MoreThan(new Date(now.getTime() - minute)),
        })) ||
        (await requests.countBy({ idUser: actor.idUser, createdAt: recent })) >= 5 ||
        (await requests.countBy({ newEmail: dto.newEmail, createdAt: recent })) >= 5 ||
        (await requests.countBy({ createdAt: recent })) >= 100
      )
        throw new HttpException(
          'Espera antes de solicitar otro enlace.',
          HttpStatus.TOO_MANY_REQUESTS,
        );

      await manager.query(
        'DELETE FROM email_change_requests WHERE id IN (SELECT id FROM email_change_requests WHERE created_at < $1 ORDER BY created_at LIMIT 100)',
        [new Date(now.getTime() - 24 * 60 * minute)],
      );
      await requests.update(
        { idUser: actor.idUser, consumedAt: IsNull(), invalidatedAt: IsNull() },
        { invalidatedAt: now },
      );
      return requests.save(
        requests.create({
          idUser: actor.idUser,
          idSession: actor.idSession,
          newEmail: dto.newEmail,
          oldEmail: user.email,
          tokenHash: digest(token),
          createdAt: now,
          expiresAt: new Date(now.getTime() + 15 * minute),
        }),
      );
    });

    try {
      await this.mail.send(await verificationEmail(pending.newEmail, link));
    } catch {
      try {
        await this.requests.update(
          { id: pending.id, consumedAt: IsNull() },
          { invalidatedAt: new Date() },
        );
      } catch {
        this.logger.warn('email_change_failed_delivery_invalidation');
      }
      throw new ServiceUnavailableException('No pudimos enviar el enlace de verificación.');
    }
    return { newEmail: pending.newEmail, expiresAt: pending.expiresAt };
  }

  async confirm(actor: JwtPayload, token: string) {
    let previousEmail: string;
    try {
      previousEmail = await this.requests.manager.transaction(async (manager) => {
        const users = manager.getRepository(User);
        const user = await users.findOne({
          where: { idUser: actor.idUser, isActive: true },
          select: { idUser: true, email: true },
          lock: { mode: 'pessimistic_write' },
        });
        const requests = manager.getRepository(EmailChangeRequest);
        const pending = await requests.findOne({
          where: {
            tokenHash: digest(token),
            idUser: actor.idUser,
            consumedAt: IsNull(),
            invalidatedAt: IsNull(),
          },
          lock: { mode: 'pessimistic_write' },
        });
        if (
          !user ||
          !pending ||
          pending.oldEmail !== user.email ||
          !(await this.activeSessions(manager, actor, pending.idSession))
        ) {
          throw new GoneException(unavailableMessage);
        }
        if (pending.expiresAt <= new Date()) {
          throw new GoneException('Este enlace ha vencido. Solicita uno nuevo.');
        }
        await this.assertEmailAvailable(users, pending.newEmail, actor.idUser);
        const now = new Date();
        await users.update(actor.idUser, { email: pending.newEmail, updatedBy: actor.idUser });
        await requests.update(pending.id, { consumedAt: now });
        await manager.getRepository(UserSession).update(
          { user: { idUser: actor.idUser }, isActive: true },
          {
            isActive: false,
            revokedAt: now,
            revokedReason: SessionRevokeReasons.LOGOUT_ALL,
            revokedBy: { idUser: actor.idUser },
          },
        );
        return user.email;
      });
    } catch (error) {
      const driver: unknown = error instanceof QueryFailedError ? error.driverError : undefined;
      if (driver && typeof driver === 'object' && 'code' in driver && driver.code === '23505') {
        throw new ConflictException('Ese correo electrónico ya está en uso.');
      }
      throw error;
    }

    try {
      await this.mail.send(await emailChangeNotice(previousEmail));
    } catch {
      this.logger.warn({ event: 'email_change_security_notice_failed', idUser: actor.idUser });
    }
  }

  private async assertEmailAvailable(users: Repository<User>, email: string, idUser: number) {
    if (
      await users
        .createQueryBuilder('account')
        .withDeleted()
        .where('lower(account.email) = :email', { email })
        .andWhere({ idUser: Not(idUser) })
        .getExists()
    ) {
      throw new ConflictException('Ese correo electrónico ya está en uso.');
    }
  }

  private async activeSessions(
    manager: EntityManager,
    actor: JwtPayload,
    origin = actor.idSession,
  ) {
    const ids = [...new Set([actor.idSession, origin])];
    const active = await manager
      .getRepository(UserSession)
      .createQueryBuilder('session')
      .select('session.idSession')
      .where(
        'session.idSession IN (:...ids) AND session.id_user = :idUser AND session.isActive = true AND session.expiresAt > :now',
        { ids, idUser: actor.idUser, now: new Date() },
      )
      .orderBy('session.idSession', 'ASC')
      .setLock('pessimistic_write')
      .getMany();
    return active.length === ids.length;
  }

  private verificationLink(token: string) {
    try {
      const base = new URL(
        this.config.get<string>('MAIL_VERIFICATION_ORIGIN') ||
          this.config.getOrThrow<string>('FRONTEND_URL'),
      );
      const local = ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname);
      if (
        base.username ||
        base.password ||
        base.search ||
        base.hash ||
        base.pathname !== '/' ||
        (base.protocol !== 'https:' &&
          !(base.protocol === 'http:' && local && this.config.get('NODE_ENV') !== 'production'))
      ) {
        throw new Error('Invalid mail origin');
      }
      const url = new URL('/account/verify-email', base);
      url.hash = new URLSearchParams({ token }).toString();
      return url.toString();
    } catch {
      this.logger.warn(
        'Configura un origen de verificación válido en MAIL_VERIFICATION_ORIGIN o FRONTEND_URL.',
      );
      throw new ServiceUnavailableException('La verificación de correo no está disponible.');
    }
  }
}
