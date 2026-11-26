import {
  BadRequestException,
  HttpException,
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';
import * as bcrypt from 'bcrypt';
import { isEmail } from 'class-validator';
import type { JwtPayload } from '@common/types/jwt-payload.type';
import { DataSource, EntityManager } from 'typeorm';
import { passwordPolicyError } from '@repo/password-policy';
import { SessionRevokeReasons } from '@common/enums/sessionRevokeReasons';
import { User } from 'src/entities/users/users.entity';
import { UserSession } from 'src/entities/user-sessions/user-sessions.entity';
import { PasswordRecoveryRequest } from 'src/entities/password-recovery-requests/password-recovery-request.entity';
import { recoveryCodeEmail, passwordResetNotice } from 'src/core/mail/institutional-email';
import type { ResetRecoveryDto, VerifyRecoveryDto } from 'src/dtos/auth/password-recovery.dto';
import { MailService } from '../mail/mail.service';

const unavailable = 'La recuperación no está disponible temporalmente.';
const invalidCode = 'El código no es correcto. Revísalo o solicita uno nuevo.';
const invalidProof = 'La autorización de recuperación ya no es válida. Solicita un nuevo código.';

@Injectable()
export class PasswordRecoveryService {
  private readonly logger = new Logger(PasswordRecoveryService.name);

  constructor(
    private readonly db: DataSource,
    private readonly config: ConfigService,
    private readonly mail: MailService,
  ) {}

  private digest(scope: string, value: string) {
    const key = this.config.get<string>('PASSWORD_RECOVERY_HMAC_KEY');
    if (!key || !/^[0-9a-f]{64}$/i.test(key)) throw new ServiceUnavailableException(unavailable);
    return createHmac('sha256', Buffer.from(key, 'hex'))
      .update(scope)
      .update('\0')
      .update(value)
      .digest('hex');
  }

  private equal(left: string, right: string) {
    return timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));
  }

  // Lock ordering is consistent across instances. The timestamp array holds a rolling window.
  private async limit(
    manager: EntityManager,
    scope: string,
    value: string,
    max: number,
    seconds: number,
  ) {
    const bucket = this.digest(scope, value);
    await manager.query(
      `
      INSERT INTO password_recovery_limits(bucket, attempts, expires_at)
      VALUES ($1, '{}', clock_timestamp()) ON CONFLICT DO NOTHING
    `,
      [bucket],
    );
    const [row]: { attempts: Date[] }[] = await manager.query(
      `
      SELECT ARRAY(SELECT stamp FROM unnest(attempts) AS stamp
        WHERE stamp > clock_timestamp() - make_interval(secs => $2)) AS attempts
      FROM password_recovery_limits WHERE bucket = $1 FOR UPDATE
    `,
      [bucket, seconds],
    );
    if (row.attempts.length >= max) return false;
    await manager.query(
      `
      UPDATE password_recovery_limits SET attempts = array_append($2::timestamptz[], clock_timestamp()),
        expires_at = clock_timestamp() + make_interval(secs => $3) WHERE bucket = $1
    `,
      [bucket, row.attempts, seconds],
    );
    return true;
  }

  private async confirmed(manager: EntityManager, id: number, email: string) {
    const [row]: { new_email: string }[] = await manager.query(
      `
      SELECT new_email FROM email_change_requests WHERE id_user = $1 AND consumed_at IS NOT NULL
      ORDER BY consumed_at DESC LIMIT 1
    `,
      [id],
    );
    return row?.new_email === email;
  }

  async requestByAdministrator(actor: JwtPayload, idUser: number) {
    try {
      if (!actor.roles.includes('SUPERADMIN') || actor.idUser === idUser)
        throw new ForbiddenException('No tienes permiso para restablecer esta cuenta.');
      if (!Number.isSafeInteger(idUser) || idUser <= 0 || idUser > 2147483647)
        throw new BadRequestException('Usuario inválido.');

      const { id, code, digest } = this.createCode();
      const link = this.administratorLink(id);
      this.mail.assertConfigured();
      const email = await this.db.transaction(async (manager) => {
        if (
          !(await this.limit(manager, 'admin:actor', String(actor.idUser), 15, 3600)) ||
          !(await this.limit(manager, 'request:global', 'all', 120, 3600))
        )
          return null;

        const users = manager.getRepository(User);
        // Lock both accounts in a fixed order before reading current roles.
        const accounts = await users
          .createQueryBuilder('account')
          .where('account.idUser IN (:...ids) AND account.isActive = true', {
            ids: [actor.idUser, idUser],
          })
          .orderBy('account.idUser', 'ASC')
          .setLock('pessimistic_write')
          .getMany();
        const roles: { id_user: number; name: string; is_active: boolean }[] = await manager.query(
          `
          SELECT ur."usersIdUser" AS id_user, r.name, r.is_active AND r.deleted_at IS NULL AS is_active FROM user_role ur
          JOIN roles r ON r.id_role = ur."rolesIdRole"
          WHERE ur."usersIdUser" IN ($1, $2)
        `,
          [actor.idUser, idUser],
        );
        if (
          !accounts.some((account) => account.idUser === actor.idUser) ||
          !roles.some(
            (role) => role.id_user === actor.idUser && role.name === 'SUPERADMIN' && role.is_active,
          )
        )
          throw new ForbiddenException('No tienes permiso para restablecer esta cuenta.');
        const target = accounts.find((account) => account.idUser === idUser);
        if (!target)
          throw new BadRequestException('La cuenta no está disponible para recuperación.');
        if (
          roles.some(
            (role) => role.id_user === idUser && !['STUDENT', 'ASSISTANT'].includes(role.name),
          )
        )
          throw new ForbiddenException('No tienes permiso para restablecer esta cuenta.');
        const address = target.email.trim().toLowerCase();
        if (
          !isEmail(address) ||
          address.length > 254 ||
          !(await this.confirmed(manager, idUser, address))
        )
          throw new BadRequestException(
            'La cuenta necesita un correo confirmado para usar la recuperación.',
          );
        return (await this.reserve(manager, idUser, address, id, digest)) ? address : null;
      });
      if (!email) throw new HttpException('Espera antes de solicitar otro restablecimiento.', 429);
      if (!(await this.deliver(id, email, code, link)))
        throw new ServiceUnavailableException(
          'No pudimos iniciar el restablecimiento. Inténtalo nuevamente.',
        );
      this.logger.log({
        event: 'administrative_password_recovery',
        actorId: actor.idUser,
        targetId: idUser,
        result: 'accepted',
      });
    } catch (error) {
      this.logger.warn({
        event: 'administrative_password_recovery',
        actorId: actor.idUser,
        targetId: idUser,
        result: 'rejected',
        status: error instanceof HttpException ? error.getStatus() : 500,
      });
      throw error;
    }
  }

  private administratorLink(id: string) {
    try {
      const origin = new URL(
        this.config.get<string>('MAIL_VERIFICATION_ORIGIN') ||
          this.config.getOrThrow<string>('FRONTEND_URL'),
      );
      const local = ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname);
      if (
        origin.username ||
        origin.password ||
        origin.search ||
        origin.hash ||
        origin.pathname !== '/' ||
        (origin.protocol !== 'https:' &&
          !(origin.protocol === 'http:' && local && this.config.get('NODE_ENV') !== 'production'))
      )
        throw new Error('Invalid mail origin');
      const url = new URL('/forgot-password/verify', origin);
      url.hash = new URLSearchParams({ recovery: id }).toString();
      return url.toString();
    } catch {
      throw new ServiceUnavailableException(unavailable);
    }
  }

  private createCode() {
    const id = randomUUID();
    const code = randomInt(1_000_000).toString().padStart(6, '0');
    const digest = this.digest('code:' + id, code);
    return { id, code, digest };
  }

  async request(email: string, ip: string) {
    this.mail.assertConfigured();
    const { id, code, digest } = this.createCode();
    const outcome = await this.db.transaction(async (manager) => {
      if (!(await this.limit(manager, 'request:ip', ip, 15, 3600))) return 'limited';
      if (!(await this.limit(manager, 'request:global', 'all', 120, 3600))) return 'limited';
      if (!(await this.limit(manager, 'request:email:minute', email, 1, 60))) return 'ignored';
      if (!(await this.limit(manager, 'request:email:hour', email, 3, 3600))) return 'ignored';
      return 'accepted';
    });

    if (outcome === 'limited')
      throw new HttpException('Demasiadas solicitudes. Inténtalo más tarde.', 429);
    this.logger.log('Solicitud de recuperación procesada.');
    if (outcome === 'accepted') {
      setImmediate(() => {
        void this.issue(id, email, digest, code).catch(() =>
          this.logger.warn('Falló el procesamiento de una solicitud de recuperación.'),
        );
      });
    }
    return { id, retryAfter: 60 };
  }

  private async issue(id: string, email: string, digest: string, code: string) {
    const pending = await this.db.transaction(async (manager) => {
      const [user]: { id_user: number }[] = await manager.query(
        `
        SELECT id_user FROM users WHERE lower(email) = $1 AND is_active AND deleted_at IS NULL FOR UPDATE
      `,
        [email],
      );
      if (!user || !(await this.confirmed(manager, user.id_user, email))) return false;
      return this.reserve(manager, user.id_user, email, id, digest);
    });
    if (pending) await this.deliver(id, email, code);
  }

  private async reserve(
    manager: EntityManager,
    idUser: number,
    email: string,
    id: string,
    digest: string,
  ) {
    const [account]: { allowed: boolean }[] = await manager.query(
      `
        SELECT count(*) FILTER (WHERE created_at > clock_timestamp() - interval '1 hour') < 3
          AND count(*) FILTER (WHERE created_at > clock_timestamp() - interval '1 minute') = 0 AS allowed
        FROM password_recovery_requests WHERE id_user = $1 AND created_at > clock_timestamp() - interval '1 hour'
      `,
      [idUser],
    );
    if (!account.allowed) return false;
    await manager.query(
      `
        UPDATE password_recovery_requests SET state = 'invalidated', proof_digest = NULL
        WHERE id_user = $1 AND state IN ('pending','sent','verified')
      `,
      [idUser],
    );
    await manager.query(
      `
        INSERT INTO password_recovery_requests(id, id_user, email, code_digest, expires_at, state)
        VALUES ($1, $2, $3, $4, clock_timestamp() + interval '10 minutes', 'pending')
      `,
      [id, idUser, email, digest],
    );
    return true;
  }

  private async deliver(id: string, email: string, code: string, link?: string) {
    try {
      await this.mail.send(await recoveryCodeEmail(email, code, link));
      await this.db.query(
        "UPDATE password_recovery_requests SET state = 'sent' WHERE id = $1 AND state = 'pending'",
        [id],
      );
      return true;
    } catch {
      this.logger.warn('Falló el envío de recuperación.');
      await this.db
        .query(
          "UPDATE password_recovery_requests SET state = 'invalidated' WHERE id = $1 AND state = 'pending'",
          [id],
        )
        .catch(() => this.logger.warn('Falló la invalidación de una solicitud pendiente.'));
      return false;
    }
  }

  async verify(dto: VerifyRecoveryDto, ip: string) {
    const outcome = await this.db.transaction(async (manager) => {
      if (!(await this.limit(manager, 'verify:ip', ip, 60, 3600))) return { error: 'limited' };
      const row = await manager.getRepository(PasswordRecoveryRequest).findOne({
        where: { id: dto.id },
        select: { id: true, codeDigest: true, expiresAt: true, state: true, attempts: true },
        lock: { mode: 'pessimistic_write' },
      });
      const expected = this.digest('code:' + dto.id, dto.code);
      // Public failures stay identical even for synthetic identifiers.
      const matches = this.equal(row?.codeDigest ?? '0'.repeat(64), expected);
      if (!row || row.state !== 'sent' || row.expiresAt.getTime() <= Date.now())
        return { error: 'invalid' };
      if (!matches) {
        const attempts = row.attempts + 1;
        await manager.query(
          `
          UPDATE password_recovery_requests SET attempts = $2, state = CASE WHEN $2 = 5 THEN 'blocked' ELSE 'sent' END WHERE id = $1
        `,
          [dto.id, attempts],
        );
        this.logger.warn(
          attempts === 5
            ? 'Intentos de recuperación agotados.'
            : 'Verificación de recuperación fallida.',
        );
        return { error: 'invalid' };
      }

      const proof = randomBytes(32).toString('hex');
      await manager.query(
        `
        UPDATE password_recovery_requests SET state = 'verified', verified_at = clock_timestamp(), proof_digest = $2
        WHERE id = $1
      `,
        [dto.id, createHash('sha256').update(proof).digest('hex')],
      );
      return {
        proof,
        maxAge: Math.max(0, Math.floor((row.expiresAt.getTime() - Date.now()) / 1000)),
      };
    });

    if (outcome.error === 'limited')
      throw new HttpException('Demasiados intentos. Inténtalo más tarde.', 429);
    if (!outcome.proof || !outcome.maxAge) throw new BadRequestException(invalidCode);
    return { proof: outcome.proof, maxAge: outcome.maxAge };
  }

  async reset(dto: ResetRecoveryDto, ip: string) {
    const error = passwordPolicyError(dto.password);
    if (error) throw new BadRequestException(error);
    const proof = createHash('sha256').update(dto.proof).digest('hex');
    const outcome = await this.db.transaction(async (manager) => {
      if (!(await this.limit(manager, 'reset:ip', ip, 30, 3600))) return { error: 'limited' };
      const requests = manager.getRepository(PasswordRecoveryRequest);
      const options = {
        where: { id: dto.id },
        select: {
          id: true,
          idUser: true,
          email: true,
          state: true,
          expiresAt: true,
          proofDigest: true,
        },
      };
      const candidate = await requests.findOne(options);
      if (!this.authorized(candidate, proof)) return { error: 'invalid' };
      const users = manager.getRepository(User);
      const user = await users.findOne({
        where: { idUser: candidate.idUser, isActive: true },
        select: { idUser: true, email: true, password: true },
        lock: { mode: 'pessimistic_write' },
      });
      const locked = await requests.findOne({ ...options, lock: { mode: 'pessimistic_write' } });
      if (
        !user ||
        !this.authorized(locked, proof) ||
        user.email.trim().toLowerCase() !== locked.email ||
        !(await this.confirmed(manager, user.idUser, locked.email))
      )
        return { error: 'invalid' };
      if (await bcrypt.compare(dto.password, user.password)) return { error: 'same' };
      const password = await bcrypt.hash(dto.password, 10);
      if (locked.expiresAt.getTime() <= Date.now()) return { error: 'invalid' };

      await users.update(user.idUser, { password, updatedBy: user.idUser });
      await manager.getRepository(UserSession).update(
        { user: { idUser: user.idUser }, isActive: true },
        {
          isActive: false,
          revokedAt: new Date(),
          revokedReason: SessionRevokeReasons.PASSWORD_CHANGED,
          revokedBy: { idUser: user.idUser },
        },
      );
      await manager.query(
        `
        UPDATE password_recovery_requests
        SET state = CASE WHEN id = $1 THEN 'consumed' ELSE 'invalidated' END,
          consumed_at = CASE WHEN id = $1 THEN clock_timestamp() ELSE NULL END, proof_digest = NULL
        WHERE id_user = $2 AND state IN ('pending','sent','verified')
      `,
        [dto.id, user.idUser],
      );
      return { email: locked.email };
    });
    if (outcome.error === 'limited')
      throw new HttpException('Demasiados intentos. Inténtalo más tarde.', 429);
    if (outcome.error === 'same')
      throw new BadRequestException('La nueva contraseña debe ser distinta de la actual.');
    if (!outcome.email) throw new BadRequestException(invalidProof);
    const email = outcome.email;
    this.logger.log('Recuperación de contraseña completada.');
    setImmediate(() => void this.notify(email));
  }

  private authorized(
    row: PasswordRecoveryRequest | null,
    proof: string,
  ): row is PasswordRecoveryRequest {
    return (
      !!row &&
      row.state === 'verified' &&
      row.expiresAt.getTime() > Date.now() &&
      !!row.proofDigest &&
      this.equal(row.proofDigest, proof)
    );
  }

  private async notify(email: string) {
    try {
      await this.mail.send(await passwordResetNotice(email));
    } catch {
      this.logger.warn('Falló la notificación de restablecimiento.');
    }
  }
}
