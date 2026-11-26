import { ConflictException, INestApplication, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PassportModule } from '@nestjs/passport';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { EmailChangeController } from 'src/controllers/users/email-change.controller';
import { EmailChangeService } from 'src/services/users/email-change.service';
import { EmailChangeRequest } from 'src/entities/email-change-requests/email-change-request.entity';
import { MailService } from 'src/services/mail/mail.service';
import type { MailMessage } from 'src/services/mail/mail.service';
import { Readable } from 'node:stream';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';
import { httpCorsOptions } from '@core/config/http-cors.config';
import sharp from 'sharp';
import { ProfileAvatarController } from 'src/controllers/users/profile-avatar.controller';
import { ProfileAvatarService } from 'src/services/users/profile-avatar.service';
import { AvatarStorage } from 'src/services/users/avatar-storage.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Server } from 'node:http';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';
import { refreshDigest } from '@common/utils/refresh-digest';
import { SessionRevokeReasons } from '@common/enums/sessionRevokeReasons';
import { AUTH_TRANSPORT_HEADER } from '@core/guards/auth/auth-transport.guard';
import { JwtAuthGuard } from '@core/guards/auth/auth.guard';
import { JwtStrategy } from '@core/strategies/jwt/jwt.strategy';
import { createValidationPipe } from '@core/pipes/validation.pipe';
import { ResponseInterceptor } from '@core/interceptors/response/response.interceptor';
import { AuthController } from 'src/controllers/auth/auth.controller';
import { SessionsController } from 'src/controllers/sessions/sessions.controller';
import { PermissionsGuard } from '@core/guards/permissions/permissions.guard';
import { RememberMeSessions1795536000000 } from 'src/database/migrations/1795536000000-RememberMeSessions';
import { UserSession } from 'src/entities/user-sessions/user-sessions.entity';
import { User } from 'src/entities/users/users.entity';
import { UsersService } from 'src/services/users/users.service';
import { RolesService } from 'src/services/roles/roles.service';
import { BulkOperationsService } from 'src/services/bulk-operations/bulk-operations.service';
import { SessionsService } from 'src/services/sessions/sessions.service';
import { createSeedTestDatabase } from '../../../test/seeders-postgres';
import { AuthService } from './auth.service';
import { PasswordRecoveryController } from 'src/controllers/auth/password-recovery.controller';
import { UserPasswordRecoveryController } from 'src/controllers/users/user-password-recovery.controller';
import { PasswordRecoveryService } from './password-recovery.service';

const pgBin = process.env.ATTENDANCE_TEST_PG_BIN;
(pgBin ? describe : describe.skip)('REM-2 isolated PostgreSQL validation', () => {
  let database: Awaited<ReturnType<typeof createSeedTestDatabase>>;
  let source: DataSource;
  let app: INestApplication<Server>;
  let auth: AuthService;
  let usersService: UsersService;
  let sessionsService: SessionsService;
  let idUser: number;
  let idSession: number;
  const migration = new RememberMeSessions1795536000000();
  const transportKey = 'b'.repeat(64);
  const password = 'rem32-fixture-password';
  const jwt = new JwtService();
  const hour = 3600;
  let sequence = 0;
  const objects = new Map<string, Buffer>();
  const mail = {
    assertConfigured: jest.fn(),
    send: jest.fn<Promise<void>, [MailMessage]>(() => Promise.resolve()),
  };
  const storage = {
    put: jest.fn((key: string, data: Buffer) => {
      objects.set(key, data);
      return Promise.resolve();
    }),
    get: jest.fn((key: string) => {
      const body = objects.get(key);
      return Promise.resolve(body ? Readable.from(body) : null);
    }),
    remove: jest.fn((key: string) => {
      objects.delete(key);
      return Promise.resolve();
    }),
  };

  type Credentials = {
    accessToken: string;
    refreshToken: string;
    sessionExpiresAt: string;
    rememberMe: boolean | null;
  };
  type Claims = { idSession: number; idUser: number; exp: number; iat: number; jti: string };
  const credentialsFrom = (body: unknown) => (body as { data: Credentials }).data;

  const fixtureUser = async () => {
    const username = `rem32-${++sequence}`;
    const repository = source.getRepository(User);
    return repository.save(
      repository.create({
        username,
        email: `${username}@test.invalid`,
        password: await bcrypt.hash(password, 4),
        name: 'REM',
        lastname: 'Fixture',
        ci: username,
        isActive: true,
      }),
    );
  };

  const post = (operation: string) =>
    request(app.getHttpServer())
      .post(`/api/auth/session/${operation}`)
      .set(AUTH_TRANSPORT_HEADER, transportKey);
  const login = async (user: User, rememberMe?: boolean) => {
    const response = await post('login')
      .send({ username: user.username, password, rememberMe })
      .expect(201);
    return credentialsFrom(response.body);
  };
  const claims = (token: string) => jwt.decode<Claims>(token);
  const rowFor = (token: string) =>
    source.getRepository(UserSession).findOneByOrFail({ idSession: claims(token).idSession });
  const checkAccess = (token: string) =>
    request(app.getHttpServer()).get('/api/auth/me').auth(token, { type: 'bearer' });

  async function migrate(direction: 'up' | 'down') {
    const runner = source.createQueryRunner();
    try {
      await migration[direction](runner);
    } finally {
      await runner.release();
    }
  }

  beforeAll(async () => {
    jest.replaceProperty(process, 'env', {
      ...process.env,
      AUTH_TRANSPORT_KEY: transportKey,
      PASSWORD_RECOVERY_HMAC_KEY: 'c'.repeat(64),
      AUTH_SESSION_TTL: '12h',
      AUTH_REMEMBERED_SESSION_TTL: '30d',
      JWT_ACCESS_SECRET: 'rem32-isolated-access-test-only',
      JWT_ACCESS_REFRESH: 'rem32-isolated-refresh-test-only',
      JWT_ACCESS_SECRET_EXPIRES_IN: '15m',
    });
    database = await createSeedTestDatabase(pgBin!, true);
    source = database.source;
    const identity = await source.query<
      { version: string; address: string; db: string; role: string }[]
    >(
      'SELECT version(), host(inet_server_addr()) AS address, current_database() AS db, current_user AS role',
    );
    expect(identity[0]).toMatchObject({
      address: '127.0.0.1',
      db: 'rem32_test',
      role: 'rem32_test',
    });
    expect(identity[0].version).toMatch(/^PostgreSQL 16\./);
    const applied = await source.runMigrations({ transaction: 'each' });
    expect(applied.map(({ name }) => name)).toContain(migration.name);
    expect(applied.at(-1)?.name).toBe('PasswordRecovery1795795200000');
    await source.undoLastMigration({ transaction: 'each' });
    expect(
      await source.query("SELECT to_regclass('password_recovery_requests') AS table_name"),
    ).toEqual([{ table_name: null }]);
    await source.undoLastMigration({ transaction: 'each' });
    expect(
      await source.query("SELECT to_regclass('password_change_attempts') AS table_name"),
    ).toEqual([{ table_name: null }]);
    await source.undoLastMigration({ transaction: 'each' });
    expect(
      await source
        .getRepository(EmailChangeRequest)
        .query("SELECT to_regclass('email_change_requests') AS table_name"),
    ).toEqual([{ table_name: null }]);
    await source.undoLastMigration({ transaction: 'each' });
    const users: { id_user: number }[] = await source.query(
      `INSERT INTO users(email,username,password,name,lastname,ci)
       VALUES ('rem2@test.invalid','rem2-test','unused','REM2','Test','rem2-ci')
       RETURNING id_user`,
    );
    idUser = users[0].id_user;
    const sessions: { id_session: number }[] = await source.query(
      `INSERT INTO user_sessions(id_user,refresh_token,expires_at,is_active)
       VALUES ($1,$2,now()+interval '1 day',true) RETURNING id_session`,
      [idUser, refreshDigest('historical-refresh')],
    );
    idSession = sessions[0].id_session;
    await source.runMigrations({ transaction: 'each' });
    const module = await Test.createTestingModule({
      imports: [PassportModule],
      controllers: [
        AuthController,
        SessionsController,
        ProfileAvatarController,
        EmailChangeController,
        PasswordRecoveryController,
        UserPasswordRecoveryController,
      ],
      providers: [
        AuthService,
        UsersService,
        SessionsService,
        ProfileAvatarService,
        EmailChangeService,
        PasswordRecoveryService,
        { provide: DataSource, useValue: source },
        { provide: MailService, useValue: mail },
        {
          provide: ConfigService,
          useValue: new ConfigService({ MAIL_VERIFICATION_ORIGIN: 'https://frontend.test' }),
        },
        {
          provide: getRepositoryToken(EmailChangeRequest),
          useValue: source.getRepository(EmailChangeRequest),
        },
        { provide: AvatarStorage, useValue: storage },
        JwtStrategy,
        JwtAuthGuard,
        PermissionsGuard,
        { provide: JwtService, useValue: jwt },
        { provide: getRepositoryToken(User), useValue: source.getRepository(User) },
        { provide: getRepositoryToken(UserSession), useValue: source.getRepository(UserSession) },
        // Neither dependency participates in authentication, password changes or account status.
        { provide: RolesService, useValue: {} },
        { provide: BulkOperationsService, useValue: {} },
      ],
    }).compile();
    app = module.createNestApplication<INestApplication<Server>>();
    if (process.env.SEC1_BROWSER_APP_DIR) app.enableCors(httpCorsOptions('http://127.0.0.1:4396'));
    app.setGlobalPrefix('api');
    app.useGlobalGuards(module.get(JwtAuthGuard), module.get(PermissionsGuard));
    app.useGlobalPipes(createValidationPipe());
    app.useGlobalInterceptors(new ResponseInterceptor());
    auth = module.get(AuthService);
    usersService = module.get(UsersService);
    sessionsService = module.get(SessionsService);
    await app.init();
  }, 90000);

  afterAll(async () => {
    try {
      await app?.close();
    } finally {
      jest.restoreAllMocks();
      await database?.close();
    }
  }, 45000);

  it('lets a superadmin initiate recovery without changing credentials until the recipient resets', async () => {
    const admin = await fixtureUser();
    const target = await fixtureUser();
    const [role]: { id_role: number }[] = await source.query(
      "INSERT INTO roles(name) VALUES ('SUPERADMIN') ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id_role",
    );
    await source.query('INSERT INTO user_role("usersIdUser","rolesIdRole") VALUES ($1,$2)', [
      admin.idUser,
      role.id_role,
    ]);
    const actor = await login(admin);
    const before = await login(target, true);
    const administrative = (id: number) =>
      request(app.getHttpServer()).post(`/api/users/${id}/password-reset`);
    await administrative(target.idUser).expect(401);
    await administrative(target.idUser)
      .auth(actor.accessToken, { type: 'bearer' })
      .send({ password: 'ignored-fixture' })
      .expect(400);
    await administrative(admin.idUser).auth(before.accessToken, { type: 'bearer' }).expect(403);
    await administrative(admin.idUser).auth(actor.accessToken, { type: 'bearer' }).expect(403);
    const otherAdmin = await fixtureUser();
    await source.query('INSERT INTO user_role("usersIdUser","rolesIdRole") VALUES ($1,$2)', [
      otherAdmin.idUser,
      role.id_role,
    ]);
    await administrative(otherAdmin.idUser).auth(actor.accessToken, { type: 'bearer' }).expect(403);
    await administrative(target.idUser).auth(actor.accessToken, { type: 'bearer' }).expect(400);
    await source.query(
      `
      INSERT INTO email_change_requests(id_user,id_session,new_email,old_email,token_hash,created_at,expires_at,consumed_at)
      VALUES ($1,$2,$3,'previous@test.invalid','admin-recovery-fixture',now(),now(),now())
    `,
      [target.idUser, claims(before.accessToken).idSession, target.email],
    );

    const started = await administrative(target.idUser)
      .auth(actor.accessToken, { type: 'bearer' })
      .expect(202);
    await administrative(target.idUser).auth(actor.accessToken, { type: 'bearer' }).expect(429);
    await checkAccess(before.accessToken).expect(200);
    await post('login').send({ username: target.username, password }).expect(201);

    const message = mail.send.mock.calls
      .map(([entry]) => entry)
      .find(
        (entry) =>
          entry.to === target.email &&
          entry.subject.startsWith('Restablecimiento de contraseña solicitado'),
      );
    expect(message?.inlineImages).toHaveLength(1);
    const code = message?.text
      .match(/\b(\d{3}) (\d{3})\b/)
      ?.slice(1)
      .join('');
    const id = message?.text.match(/\/forgot-password\/verify#recovery=([a-f0-9-]+)/)?.[1];
    if (!code || !id) throw new Error('Synthetic administrative mail is incomplete.');
    expect(started.text).not.toContain(id);
    const recovery = (operation: string) =>
      request(app.getHttpServer())
        .post(`/api/auth/password-recovery/${operation}`)
        .set(AUTH_TRANSPORT_HEADER, transportKey);
    await recovery('verify')
      .send({ id, code: code === '000000' ? '000001' : '000000' })
      .expect(400);
    const verified = await recovery('verify').send({ id, code }).expect(200);
    await recovery('verify').send({ id, code }).expect(400);
    const { proof } = (verified.body as { data: { proof: string } }).data;
    const nextPassword = 'Administrativa-8!';
    await recovery('reset').send({ id, proof, password: nextPassword }).expect(200);
    await checkAccess(before.accessToken).expect(401);
    await post('refresh').send({ refreshToken: before.refreshToken }).expect(401);
    await post('login').send({ username: target.username, password }).expect(401);
    await post('login').send({ username: target.username, password: nextPassword }).expect(201);
  }, 15000);

  it('returns 503 before sending mail when the dedicated recovery key is missing', async () => {
    const key = process.env.PASSWORD_RECOVERY_HMAC_KEY;
    const previousSendCount = mail.send.mock.calls.length;
    delete process.env.PASSWORD_RECOVERY_HMAC_KEY;

    try {
      const response = await request(app.getHttpServer())
        .post('/api/auth/password-recovery/request')
        .set(AUTH_TRANSPORT_HEADER, transportKey)
        .send({ email: 'missing-key@test.invalid' })
        .expect(503);
      expect(response.text).toContain('La recuperación no está disponible temporalmente.');
      expect(mail.send.mock.calls).toHaveLength(previousSendCount);
    } finally {
      if (key !== undefined) process.env.PASSWORD_RECOVERY_HMAC_KEY = key;
    }
  });

  it('recovers access with a single-use code and revokes earlier access and refresh tokens', async () => {
    const account = await fixtureUser();
    const ordinary = await login(account);
    const remembered = await login(account, true);
    await source.query(
      `INSERT INTO email_change_requests(id_user,id_session,new_email,old_email,token_hash,created_at,expires_at,consumed_at)
       VALUES ($1,$2,$3,'previous@test.invalid',$4,now(),now(),now())`,
      [account.idUser, claims(ordinary.accessToken).idSession, account.email, 'fixture-recovery'],
    );
    const recovery = (operation: string) =>
      request(app.getHttpServer())
        .post(`/api/auth/password-recovery/${operation}`)
        .set(AUTH_TRANSPORT_HEADER, transportKey);
    await request(app.getHttpServer())
      .post('/api/auth/password-recovery/request')
      .send({ email: account.email })
      .expect(403);
    const absent = await recovery('request').send({ email: 'unknown@test.invalid' }).expect(202);
    const started = await recovery('request')
      .send({ email: account.email.toUpperCase() })
      .expect(202);
    type FlowReply = { data: { id: string; retryAfter: number } };
    const { id } = (started.body as FlowReply).data;
    expect((started.body as FlowReply).data).toEqual({ ...(absent.body as FlowReply).data, id });
    const repeated = await recovery('request').send({ email: account.email }).expect(202);
    expect((repeated.body as FlowReply).data.id).not.toBe(id);

    for (let tries = 0; tries < 80; tries++) {
      const [row]: { state: string }[] = await source.query(
        'SELECT state FROM password_recovery_requests WHERE id = $1',
        [id],
      );
      if (row?.state === 'sent') break;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    const message = mail.send.mock.calls
      .map(([entry]) => entry)
      .find(
        (entry) => entry.to === account.email && entry.subject.startsWith('Recupera tu contraseña'),
      );
    expect(message?.inlineImages?.length).toBe(1);
    const code = message?.text
      .match(/\b(\d{3}) (\d{3})\b/)
      ?.slice(1)
      .join('');
    if (!code) throw new Error('No recovery code found in the synthetic mailbox.');
    const rows: { id: string; code_digest: string }[] = await source.query(
      'SELECT id, code_digest FROM password_recovery_requests WHERE id_user = $1',
      [account.idUser],
    );
    expect(rows.map((row) => row.id)).toEqual([id]);
    expect(rows[0].code_digest).toMatch(/^[a-f0-9]{64}$/);
    expect(rows[0].code_digest).not.toContain(code);
    const wrong = code === '000000' ? '000001' : '000000';
    const unknown = await recovery('verify')
      .send({ id: (absent.body as FlowReply).data.id, code: wrong })
      .expect(400);
    const incorrect = await recovery('verify').send({ id, code: wrong }).expect(400);
    expect((unknown.body as { message: string }).message).toEqual(
      (incorrect.body as { message: string }).message,
    );
    const verified = await recovery('verify').send({ id, code }).expect(200);
    await recovery('verify').send({ id, code }).expect(400);
    const { proof } = (verified.body as { data: { proof: string } }).data;
    expect(proof).toMatch(/^[a-f0-9]{64}$/);
    const newPassword = 'Nueva-Contraseña8!';
    const results = await Promise.all(
      Array.from({ length: 2 }, () => recovery('reset').send({ id, proof, password: newPassword })),
    );
    expect(results.map(({ status }) => status).sort()).toEqual([200, 400]);
    await recovery('reset').send({ id, proof, password: newPassword }).expect(400);
    for (const session of [ordinary, remembered]) {
      await checkAccess(session.accessToken).expect(401);
      await post('refresh').send({ refreshToken: session.refreshToken }).expect(401);
    }
    await post('login').send({ username: account.username, password }).expect(401);
    await post('login').send({ username: account.username, password: newPassword }).expect(201);
    const notice = mail.send.mock.calls
      .map(([entry]) => entry)
      .find(
        (entry) =>
          entry.to === account.email && entry.subject === 'Se actualizó la contraseña de tu cuenta',
      );
    expect(notice?.text).toContain('Si no realizaste este cambio');
    expect(notice?.text).not.toContain(newPassword);
  }, 15000);

  it('blocks five concurrent guesses, invalidates codes on resend, and rejects expired codes', async () => {
    const account = await fixtureUser();
    const session = await login(account);
    await source.query(
      `INSERT INTO email_change_requests(id_user,id_session,new_email,old_email,token_hash,created_at,expires_at,consumed_at)
       VALUES ($1,$2,$3,'previous@test.invalid','fixture-recovery-resend',now(),now(),now())`,
      [account.idUser, claims(session.accessToken).idSession, account.email],
    );
    const call = (action: string, body: object) =>
      request(app.getHttpServer())
        .post(`/api/auth/password-recovery/${action}`)
        .set(AUTH_TRANSPORT_HEADER, transportKey)
        .send(body);
    const readCode = async (id: string) => {
      for (let tries = 0; tries < 80; tries++) {
        const [row]: { state: string }[] = await source.query(
          'SELECT state FROM password_recovery_requests WHERE id = $1',
          [id],
        );
        if (row?.state === 'sent') {
          const mailEntry = mail.send.mock.calls
            .map(([entry]) => entry)
            .reverse()
            .find(
              (entry) =>
                entry.to === account.email && entry.subject.startsWith('Recupera tu contraseña'),
            );
          const code = mailEntry?.text
            .match(/\b(\d{3}) (\d{3})\b/)
            ?.slice(1)
            .join('');
          if (code) return code;
        }
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      throw new Error('A code was not sent to the synthetic mailbox.');
    };
    const releaseCooldown = async () => {
      await source.query(`
        UPDATE password_recovery_limits
        SET attempts = ARRAY(SELECT stamp - interval '61 seconds' FROM unnest(attempts) AS stamp);
        UPDATE password_recovery_requests SET created_at = created_at - interval '61 seconds'
      `);
    };
    const start = async () => {
      const result = await call('request', { email: account.email }).expect(202);
      const { id } = (result.body as { data: { id: string } }).data;
      return { id, code: await readCode(id) };
    };
    const first = await start();
    await releaseCooldown();
    const second = await start();
    await call('verify', first).expect(400);
    const wrong = second.code === '000000' ? '000001' : '000000';
    const rejected = await Promise.all(
      Array.from({ length: 7 }, () => call('verify', { id: second.id, code: wrong })),
    );
    expect(rejected.every(({ status }) => status === 400)).toBe(true);
    expect(
      await source.query('SELECT attempts,state FROM password_recovery_requests WHERE id = $1', [
        second.id,
      ]),
    ).toEqual([{ attempts: 5, state: 'blocked' }]);
    await call('verify', second).expect(400);
    await releaseCooldown();
    const third = await start();
    await source.query(
      'UPDATE password_recovery_requests SET expires_at = clock_timestamp() WHERE id = $1',
      [third.id],
    );
    await call('verify', third).expect(400);
    await releaseCooldown();
    const fourth = await call('request', { email: account.email }).expect(202);
    const [counts]: { count: number }[] = await source.query(
      'SELECT count(*)::integer AS count FROM password_recovery_requests WHERE id_user = $1',
      [account.idUser],
    );
    expect(counts.count).toBe(3);
    await call('verify', {
      id: (fourth.body as { data: { id: string } }).data.id,
      code: third.code,
    }).expect(400);
  }, 15000);

  it('updates only the holder’s personal names and refuses a direct email update', async () => {
    const account = await fixtureUser();
    const another = await fixtureUser();
    const current = await login(account);
    const expectedSession = claims(current.accessToken).idSession;
    const patch = (data: object, expected = expectedSession) =>
      request(app.getHttpServer())
        .patch('/api/auth/me')
        .query({ expectedSession: expected })
        .auth(current.accessToken, { type: 'bearer' })
        .send(data);

    await request(app.getHttpServer()).patch('/api/auth/me').send({ name: 'No' }).expect(401);
    await patch({ name: 'No' }, expectedSession + 1).expect(409);
    await patch({ name: '   ' }).expect(400);
    await patch({ lastname: null }).expect(400);
    await patch({ email: 'mal formado' }).expect(400);
    await patch({ email: `${'a'.repeat(245)}@test.invalid` }).expect(400);
    for (const field of [
      'username',
      'ci',
      'ru',
      'roles',
      'permissions',
      'isActive',
      'password',
      'idUser',
    ]) {
      await patch({ name: 'No', [field]: 'protegido' }).expect(400);
    }
    await patch({ name: 'No', email: another.email.toUpperCase() }).expect(400);

    const updated = await patch({
      name: '  María José  ',
      lastname: '  Núñez del Río  ',
    })
      .expect(200)
      .expect('Cache-Control', 'no-store');
    expect(updated.body).toMatchObject({
      data: {
        name: 'María José',
        lastname: 'Núñez del Río',
        email: account.email,
      },
    });
    expect(Object.keys((updated.body as { data: object }).data).sort()).toEqual([
      'email',
      'lastname',
      'name',
    ]);
    expect((await checkAccess(current.accessToken).expect(200)).body).toMatchObject({
      data: {
        name: 'María José',
        lastname: 'Núñez del Río',
        email: account.email,
        ru: null,
        ci: account.ci,
      },
    });
    const repository = source.getRepository(User);
    expect(await repository.findOneByOrFail({ idUser: another.idUser })).toMatchObject({
      name: another.name,
      lastname: another.lastname,
      email: another.email,
    });
    expect(await repository.findOneByOrFail({ idUser: account.idUser })).toMatchObject({
      username: account.username,
      email: account.email,
      isActive: true,
    });
  });

  it('requires reauthentication, limits resend and consumes an email link once across devices', async () => {
    const account = await fixtureUser();
    const foreign = await fixtureUser();
    const one = await login(account);
    const two = await login(account);
    const other = await login(foreign);
    const ask = (newEmail: string, currentPassword = password) =>
      request(app.getHttpServer())
        .post('/api/users/me/email-change')
        .auth(one.accessToken, { type: 'bearer' })
        .query({ expectedSession: claims(one.accessToken).idSession })
        .send({ newEmail, currentPassword, idUser: foreign.idUser });
    const confirm = (accessToken: string, token: string) =>
      request(app.getHttpServer())
        .post('/api/users/email-change/confirm')
        .auth(accessToken, { type: 'bearer' })
        .query({ expectedSession: claims(accessToken).idSession })
        .send({ token });
    const pending = () =>
      request(app.getHttpServer())
        .get('/api/users/me/email-change')
        .auth(one.accessToken, { type: 'bearer' })
        .query({ expectedSession: claims(one.accessToken).idSession });
    const requests = source.getRepository(EmailChangeRequest);
    const users = source.getRepository(User);
    const destination = 'mail-change-success@test.invalid';
    const issuedToken = () => {
      const message = mail.send.mock.calls.at(-1)![0];
      return message.text.match(/#token=([a-zA-Z0-9_-]{43})/)![1];
    };

    await request(app.getHttpServer())
      .post('/api/users/me/email-change')
      .send({ newEmail: destination })
      .expect(401);
    await ask('invalid').expect(400);
    await ask(account.email.toUpperCase()).expect(400);
    await ask(foreign.email.toUpperCase()).expect(409);
    await ask(destination, 'invalid').expect(400);
    const initial = await ask(destination.toUpperCase()).expect(200);
    const first = issuedToken();
    expect(initial.text).not.toContain(first);
    expect(initial.text).not.toContain(password);
    expect((await pending().expect(200)).body).toMatchObject({ data: { newEmail: destination } });
    expect((await users.findOneByOrFail({ idUser: account.idUser })).email).toBe(account.email);
    await ask(destination).expect(429);
    await confirm(other.accessToken, first).expect(410);

    await requests.update({ idUser: account.idUser }, { createdAt: new Date(Date.now() - 61_000) });
    await ask(destination).expect(200);
    const token = issuedToken();
    expect(token).not.toBe(first);
    await confirm(two.accessToken, first).expect(410);
    const results = await Promise.all([
      confirm(two.accessToken, token),
      confirm(one.accessToken, token),
    ]);
    expect(results.filter((result) => result.status === 200)).toHaveLength(1);
    expect(results.every((result) => [200, 401, 410].includes(result.status))).toBe(true);
    expect(mail.send.mock.calls.at(-1)![0]).toMatchObject({
      to: account.email,
      subject: 'Se actualizó el correo de tu cuenta',
    });
    expect((await users.findOneByOrFail({ idUser: account.idUser })).email).toBe(destination);
    expect((await users.findOneByOrFail({ idUser: foreign.idUser })).email).toBe(foreign.email);
    await checkAccess(one.accessToken).expect(401);
    await checkAccess(two.accessToken).expect(401);
    await confirm((await login(account)).accessToken, token).expect(410);
  });

  it('rejects expired or revoked email changes and preserves commits when only the notice fails', async () => {
    const account = await fixtureUser();
    const other = await fixtureUser();
    const first = await login(account);
    const second = await login(account);
    const requestRepository = source.getRepository(EmailChangeRequest);
    const userRepository = source.getRepository(User);
    const endpoint = (path: string, access: string) =>
      request(app.getHttpServer())
        .post(path)
        .auth(access, { type: 'bearer' })
        .query({ expectedSession: claims(access).idSession });
    const ask = (email: string, access = first.accessToken) =>
      endpoint('/api/users/me/email-change', access).send({
        newEmail: email,
        currentPassword: password,
      });
    const confirm = (token: string) =>
      endpoint('/api/users/email-change/confirm', second.accessToken).send({ token });
    const pending = () =>
      request(app.getHttpServer())
        .get('/api/users/me/email-change')
        .auth(second.accessToken, { type: 'bearer' })
        .query({ expectedSession: claims(second.accessToken).idSession });
    const token = () =>
      mail.send.mock.calls.at(-1)![0].text.match(/#token=([a-zA-Z0-9_-]{43})/)![1];
    const ageRequests = () =>
      requestRepository.update(
        { idUser: account.idUser },
        { createdAt: new Date(Date.now() - 61_000) },
      );
    const desired = 'mail-change-failures@test.invalid';

    await confirm('A'.repeat(43)).expect(410);
    mail.send.mockRejectedValueOnce(new Error('SMTP failed'));
    await ask(desired).expect(503);
    await confirm(token()).expect(410);
    expect((await pending().expect(200)).body).toMatchObject({ data: null });
    expect((await userRepository.findOneByOrFail({ idUser: account.idUser })).email).toBe(
      account.email,
    );

    await ageRequests();
    await ask(desired).expect(200);
    const expired = token();
    expect((await pending().expect(200)).body).toMatchObject({ data: { newEmail: desired } });
    await requestRepository.update({ idUser: account.idUser }, { expiresAt: new Date() });
    expect((await pending().expect(200)).body).toMatchObject({ data: null });
    const expiredResponse = await confirm(expired).expect(410);
    expect(expiredResponse.body).toMatchObject({
      message: 'Este enlace ha vencido. Solicita uno nuevo.',
    });
    expect((await userRepository.findOneByOrFail({ idUser: account.idUser })).email).toBe(
      account.email,
    );

    await ageRequests();
    await ask(desired).expect(200);
    const occupied = token();
    expect(occupied).not.toBe(expired);
    await confirm(expired).expect(410);
    await userRepository.update(other.idUser, { email: desired.toUpperCase() });
    await confirm(occupied).expect(409);
    await userRepository.update(other.idUser, { email: other.email });
    await sessionsService.logoutByIdentity(claims(first.accessToken).idSession, account.idUser);
    await confirm(occupied).expect(410);

    await ageRequests();
    await ask(desired, second.accessToken).expect(200);
    const valid = token();
    const transaction = jest
      .spyOn(source.manager, 'transaction')
      .mockRejectedValueOnce(new Error('Database unavailable'));
    try {
      await confirm(valid).expect(500);
    } finally {
      transaction.mockRestore();
    }
    expect((await userRepository.findOneByOrFail({ idUser: account.idUser })).email).toBe(
      account.email,
    );
    await expect(
      userRepository.update(other.idUser, { email: account.email.toUpperCase() }),
    ).rejects.toMatchObject({ code: '23505' });
    mail.send.mockRejectedValueOnce(new Error('Notification failed'));
    await confirm(valid).expect(200);
    expect((await userRepository.findOneByOrFail({ idUser: account.idUser })).email).toBe(desired);
    const next = await login(account);
    const status = await request(app.getHttpServer())
      .get('/api/users/me/email-change')
      .auth(next.accessToken, { type: 'bearer' })
      .query({ expectedSession: claims(next.accessToken).idSession })
      .expect(200);
    expect(status.body).toMatchObject({ data: null });
  });

  it('streams private avatars, serializes concurrent replacements and handles storage and database failures', async () => {
    const account = await fixtureUser();
    const reader = await fixtureUser();
    const current = await login(account);
    const readerSession = await login(reader);
    const expectedSession = claims(current.accessToken).idSession;
    const authorizedReader = jwt.sign(
      {
        ...claims(readerSession.accessToken),
        roles: [],
        permissions: ['user.get-one-by-id'],
      },
      { secret: process.env.JWT_ACCESS_SECRET },
    );
    const url = '/api/users/me/avatar';
    const other = `/api/users/id/${account.idUser}/avatar`;
    const http = () => request(app.getHttpServer());
    const upload = (buffer: Buffer, contentType: string, expected = expectedSession) =>
      http()
        .put(url)
        .query({ expectedSession: expected })
        .auth(current.accessToken, { type: 'bearer' })
        .attach('file', buffer, { filename: 'fixture', contentType });
    const image = (width = 300) =>
      sharp({
        create: { width, height: 180, channels: 3, background: 'blue' },
      });
    const png = await image().png().toBuffer();
    const transparent = () =>
      sharp({
        create: {
          width: 300,
          height: 180,
          channels: 4,
          background: { r: 24, g: 128, b: 80, alpha: 0.5 },
        },
      });
    await http().get(url).expect(401);
    await http().get(other).expect(401);
    await http().get(url).auth(current.accessToken, { type: 'bearer' }).expect(404);
    await http().get(other).auth(readerSession.accessToken, { type: 'bearer' }).expect(403);
    await http()
      .put(other)
      .auth(authorizedReader, { type: 'bearer' })
      .attach('file', png, 'test.png')
      .expect(404);
    await http().delete(other).auth(authorizedReader, { type: 'bearer' }).expect(404);
    await upload(png, 'image/png', expectedSession + 1).expect(409);
    await upload(Buffer.alloc(2 * 1024 * 1024 + 8), 'image/png').expect(413);
    await upload(await image(4097).png().toBuffer(), 'image/png').expect(400);
    await upload(Buffer.from('not an image'), 'image/png').expect(400);
    await upload(png, 'image/jpeg').expect(400);

    storage.put.mockRejectedValueOnce(new Error('fake storage write failure'));
    await upload(png, 'image/png').expect(503);
    const first = await upload(png, 'image/png').expect(200);
    const repository = source.getRepository(User);
    const originalKey = (await repository.findOneByOrFail({ idUser: account.idUser })).avatar!;
    expect(first.text).not.toContain(originalKey);
    const streamed = await http()
      .get(other)
      .auth(authorizedReader, { type: 'bearer' })
      .expect(200)
      .expect('Content-Type', 'image/webp')
      .expect('Cache-Control', 'private, no-store')
      .expect('X-Content-Type-Options', 'nosniff');
    expect(await sharp(streamed.body as Buffer).metadata()).toMatchObject({
      format: 'webp',
      width: 256,
      height: 256,
    });
    const profile = await checkAccess(current.accessToken).expect(200);
    expect(profile.text).not.toContain(originalKey);

    const db = jest
      .spyOn(source.manager, 'transaction')
      .mockRejectedValueOnce(new Error('fake persistence failure'));
    try {
      await upload(png, 'image/png').expect(500);
    } finally {
      db.mockRestore();
    }
    expect((await repository.findOneByOrFail({ idUser: account.idUser })).avatar).toBe(originalKey);
    expect([...objects.keys()]).toEqual([originalKey]);

    storage.remove.mockRejectedValueOnce(new Error('fake cleanup failure'));
    await upload(await image().jpeg().toBuffer(), 'image/jpeg').expect(200);
    const jpegResult = await http()
      .get(url)
      .auth(current.accessToken, { type: 'bearer' })
      .expect(200);
    expect(await sharp(jpegResult.body as Buffer).metadata()).toMatchObject({
      format: 'webp',
      hasAlpha: false,
    });
    expect(objects.has(originalKey)).toBe(true);
    for (const format of ['png', 'webp'] as const) {
      const input = await transparent().toFormat(format).toBuffer();
      const alpha = (await sharp(input).raw().toBuffer())[3];
      expect(alpha).toBeGreaterThan(0);
      expect(alpha).toBeLessThan(255);
      await upload(input, `image/${format}`).expect(200);
      const result = await http()
        .get(url)
        .auth(current.accessToken, { type: 'bearer' })
        .expect(200);
      const { data, info } = await sharp(result.body as Buffer)
        .raw()
        .toBuffer({ resolveWithObject: true });
      expect(info).toMatchObject({ width: 256, height: 256, channels: 4 });
      expect(data[3]).toBe(alpha);
      expect(data.at(-1)).toBe(alpha);
    }
    const parallel = await Promise.all([
      upload(await image().webp().toBuffer(), 'image/webp'),
      upload(png, 'image/png'),
    ]);
    expect(parallel.map((result) => result.status)).toEqual([200, 200]);
    const finalKey = (await repository.findOneByOrFail({ idUser: account.idUser })).avatar!;
    expect([...objects.keys()].sort()).toEqual([finalKey, originalKey].sort());
    for (let attempt = 0; attempt < 2; attempt++) {
      const removed = await http()
        .delete(url)
        .query({ expectedSession })
        .auth(current.accessToken, { type: 'bearer' })
        .expect(200);
      expect(removed.body).toMatchObject({ data: { avatarVersion: null } });
    }
    expect(objects.has(finalKey)).toBe(false);
    objects.delete(originalKey);
    await http().get(other).auth(authorizedReader, { type: 'bearer' }).expect(404);
    await http().get(url).auth(current.accessToken, { type: 'bearer' }).expect(404);
    await sessionsService.logoutByIdentity(expectedSession, account.idUser);
    await upload(png, 'image/png').expect(401);
    await repository.update(reader.idUser, { isActive: false });
    await http().get(other).auth(authorizedReader, { type: 'bearer' }).expect(401);
  });

  it('lists and revokes only the authenticated account’s other active sessions', async () => {
    const account = await fixtureUser();
    const current = await login(account);
    const other = await login(account);
    const another = await login(account);
    const foreign = await login(await fixtureUser());
    const expectedSession = claims(current.accessToken).idSession;
    const target = claims(other.accessToken).idSession;
    const foreignId = claims(foreign.accessToken).idSession;
    const http = () => request(app.getHttpServer());
    const list = (page: number) =>
      http()
        .get('/api/sessions/me')
        .query({ expectedSession, page, limit: 1 })
        .auth(current.accessToken, { type: 'bearer' });
    const revoke = (id?: number, expected = expectedSession) =>
      http()
        .patch(`/api/sessions/me/others${id === undefined ? '' : `/${id}`}`)
        .query({ expectedSession: expected })
        .auth(current.accessToken, { type: 'bearer' });

    await http().get('/api/sessions/me').expect(401);
    await http().get('/api/sessions').auth(current.accessToken, { type: 'bearer' }).expect(403);
    const first = await list(1).expect(200).expect('Cache-Control', 'no-store');
    expect(first.body).toMatchObject({
      data: [{ idSession: expectedSession, current: true }],
      meta: { total: 3, limit: 1, totalPages: 3 },
    });
    expect(Object.keys((first.body as { data: object[] }).data[0]).sort()).toEqual([
      'browser',
      'createdAt',
      'current',
      'device',
      'idSession',
      'lastUsedAt',
      'os',
    ]);
    const second = await list(2).expect(200);
    expect(second.body).toMatchObject({ data: [{ current: false }] });
    await revoke(foreignId).expect(404);
    await revoke(expectedSession).expect(400);
    await revoke(target, foreignId).expect(409);
    await revoke(target).expect(200);
    await checkAccess(other.accessToken).expect(401);
    await revoke().expect(200);
    await checkAccess(another.accessToken).expect(401);
    await checkAccess(foreign.accessToken).expect(200);
    await checkAccess(current.accessToken).expect(200);
    expect((await list(1).expect(200)).body).toMatchObject({ meta: { total: 1 } });
  });

  it('changes the holder’s password and invalidates access and refresh on every device', async () => {
    const account = await fixtureUser();
    const current = await login(account, true);
    const other = await login(account);
    const expectedSession = claims(current.accessToken).idSession;
    const nextPassword = 'Árbol#8' + 'x'.repeat(57);
    const update = (currentPassword: string, newPassword: string, expected = expectedSession) =>
      request(app.getHttpServer())
        .patch('/api/auth/me/password')
        .query({ expectedSession: expected })
        .auth(current.accessToken, { type: 'bearer' })
        .send({ currentPassword, newPassword, idUser: -1, roles: ['SUPERADMIN'] });

    const profile = await checkAccess(current.accessToken).expect(200);
    expect(profile.body).toMatchObject({
      data: { name: account.name, lastname: account.lastname, avatarVersion: null, roles: [] },
    });
    expect(profile.text).not.toMatch(/password|refreshToken/i);
    await request(app.getHttpServer())
      .patch('/api/auth/me/password')
      .send({ currentPassword: password, newPassword: nextPassword })
      .expect(401);
    await update('incorrect', nextPassword).expect(400);
    for (const invalid of [
      'Aa1!',
      'lowercase1!',
      'UPPERCASE1!',
      'NoNumber!',
      'NoSymbol123',
      'Áb1!' + 'á'.repeat(35),
    ]) {
      const result = await update(password, invalid).expect(400);
      expect(result.text).not.toContain(invalid);
    }
    await update(password, password).expect(400);
    await update(password, nextPassword, expectedSession + 1).expect(409);
    await checkAccess(current.accessToken).expect(200);
    const response = await update(password, nextPassword).expect(200);
    expect(response.text).not.toContain(nextPassword);
    const saved = await source.getRepository(User).findOneOrFail({
      where: { idUser: account.idUser },
      select: { idUser: true, password: true },
    });
    expect(saved.password).toMatch(/^\$2[ab]\$/);
    expect(await bcrypt.compare(nextPassword, saved.password)).toBe(true);
    expect(response.text).not.toContain(saved.password);

    for (const credentials of [current, other]) {
      await checkAccess(credentials.accessToken).expect(401);
      await post('refresh').send({ refreshToken: credentials.refreshToken }).expect(401);
      expect(await rowFor(credentials.accessToken)).toMatchObject({
        isActive: false,
        revokedReason: SessionRevokeReasons.PASSWORD_CHANGED,
      });
    }
    await post('login').send({ username: account.username, password }).expect(401);
    await post('login').send({ username: account.username, password: nextPassword }).expect(201);
  });

  it('limits incorrect password checks across sessions without revoking them', async () => {
    const account = await fixtureUser();
    const sessions = [await login(account), await login(account)];
    const attempt = (access: string, currentPassword = 'wrong-fixture') =>
      request(app.getHttpServer())
        .patch('/api/auth/me/password')
        .auth(access, { type: 'bearer' })
        .query({ expectedSession: claims(access).idSession })
        .send({ currentPassword, newPassword: 'New-fixture#9' });
    const results = await Promise.all(
      Array.from({ length: 6 }, (_, i) => attempt(sessions[i % 2].accessToken)),
    );
    expect(results.map(({ status }) => status).sort()).toEqual([400, 400, 400, 400, 400, 429]);
    for (const session of sessions) await checkAccess(session.accessToken).expect(200);
    await source.query(
      "UPDATE password_change_attempts SET expires_at = now() - interval '1 second' WHERE id_user = $1",
      [account.idUser],
    );
    await attempt(sessions[0].accessToken, password).expect(200);
    await attempt(sessions[1].accessToken, password).expect(401);
  });

  it('keeps sessions on persistence failure and permits only one simultaneous password change', async () => {
    const account = await fixtureUser();
    const one = await login(account);
    const two = await login(account);
    const apply = (access: string, newPassword: string, currentPassword = password) =>
      request(app.getHttpServer())
        .patch('/api/auth/me/password')
        .auth(access, { type: 'bearer' })
        .query({ expectedSession: claims(access).idSession })
        .send({ currentPassword, newPassword });
    const next = 'Fixture-change#7';
    const transaction = jest
      .spyOn(source.manager, 'transaction')
      .mockRejectedValueOnce(new Error('Synthetic database failure'));
    try {
      await apply(one.accessToken, next).expect(500);
    } finally {
      transaction.mockRestore();
    }
    await checkAccess(one.accessToken).expect(200);
    await post('login').send({ username: account.username, password }).expect(201);
    const results = await Promise.all([apply(one.accessToken, next), apply(two.accessToken, next)]);
    expect(results.map(({ status }) => status).sort()).toEqual([200, 401]);
    const session = await post('login')
      .send({ username: account.username, password: next })
      .expect(201);
    const access = credentialsFrom(session.body).accessToken;
    await apply(access, next, next).expect(400);
    await checkAccess(access).expect(200);
  });

  (process.env.SEC1_BROWSER_APP_DIR ? it : it.skip)(
    'changes the password from the real Next.js dialog and logs in again',
    async () => {
      const account = await fixtureUser();
      await app.listen(0, '127.0.0.1');
      const apiUrl = await app.getUrl();
      const client = resolve('../materio-dashboard');
      const { stdout } = await promisify(execFile)(
        process.execPath,
        [resolve(client, 'test/password-change.browser.cjs')],
        {
          cwd: client,
          timeout: 160000,
          windowsHide: true,
          env: {
            ...process.env,
            AUTH_API_ORIGIN: apiUrl,
            NEXT_PUBLIC_API_URL: apiUrl,
            AUTH_PUBLIC_ORIGIN: 'http://127.0.0.1:4396',
            SEC1_FIXTURE_USERNAME: account.username,
            SEC1_FIXTURE_PASSWORD: password,
          },
        },
      );
      expect(stdout).toContain('SEC-1 browser passed');
    },
    175000,
  );

  it('records the additive nullable BOOLEAN migration and preserves historical NULL sessions', async () => {
    const columns: { data_type: string; is_nullable: string }[] = await source.query(
      `SELECT data_type,is_nullable FROM information_schema.columns
       WHERE table_schema=current_schema() AND table_name='user_sessions' AND column_name='remember_me'`,
    );
    const history: { name: string }[] = await source.query(
      'SELECT name FROM migrations WHERE name=$1',
      [migration.name],
    );
    const rows: { remember_me: boolean | null; refresh_token: string }[] = await source.query(
      'SELECT remember_me,refresh_token FROM user_sessions WHERE id_session=$1',
      [idSession],
    );

    expect(columns).toEqual([{ data_type: 'boolean', is_nullable: 'YES' }]);
    expect(history).toHaveLength(1);
    expect(rows).toEqual([
      { remember_me: null, refresh_token: refreshDigest('historical-refresh') },
    ]);
    expect(await source.getRepository(UserSession).findOneByOrFail({ idSession })).toMatchObject({
      rememberMe: null,
      refreshToken: refreshDigest('historical-refresh'),
    });
  });

  it('allows exactly one concurrent refresh rotation and rejects reuse of the consumed token', async () => {
    const service = new SessionsService(source.getRepository(UserSession));
    const session = await source.getRepository(UserSession).findOne({
      where: { idSession },
      relations: ['user'],
    });
    if (!session) throw new Error('Isolated session fixture was not created');
    const previous = session.refreshToken;

    const results = await Promise.allSettled([
      service.rotateRefresh(session, previous, 'rotated-refresh-a'),
      service.rotateRefresh(session, previous, 'rotated-refresh-b'),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    const failure = results.find((result) => result.status === 'rejected');
    expect(failure?.status).toBe('rejected');
    if (failure?.status === 'rejected') expect(failure.reason).toBeInstanceOf(ConflictException);
    const stored: { refresh_token: string; remember_me: boolean | null }[] = await source.query(
      'SELECT refresh_token,remember_me FROM user_sessions WHERE id_session=$1',
      [idSession],
    );
    expect([refreshDigest('rotated-refresh-a'), refreshDigest('rotated-refresh-b')]).toContain(
      stored[0].refresh_token,
    );
    expect(stored[0].remember_me).toBeNull();
  });

  it('honors session expiry and revokes by identity without deleting its row', async () => {
    const expired: { id_session: number }[] = await source.query(
      `INSERT INTO user_sessions(id_user,refresh_token,remember_me,expires_at,is_active)
       VALUES ($1,$2,false,now()-interval '1 second',true) RETURNING id_session`,
      [idUser, refreshDigest('expired-refresh')],
    );
    const service = new SessionsService(source.getRepository(UserSession));
    await expect(
      service.validateRefreshToken('expired-refresh', idUser, expired[0].id_session),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    await service.logoutByIdentity(idSession, idUser);
    const revoked: { is_active: boolean; revoked_reason: SessionRevokeReasons | null }[] =
      await source.query('SELECT is_active,revoked_reason FROM user_sessions WHERE id_session=$1', [
        idSession,
      ]);
    expect(revoked).toEqual([{ is_active: false, revoked_reason: SessionRevokeReasons.LOGOUT }]);
    expect(
      await source.query('SELECT id_session FROM user_sessions WHERE id_session=$1', [idSession]),
    ).toHaveLength(1);
  });

  it('rolls back only remember_me in the isolated schema and can reapply the additive migration', async () => {
    const unchangedFields = () =>
      source.query<unknown[]>(
        'SELECT id_session, id_user, refresh_token, expires_at, is_active, revoked_at FROM user_sessions WHERE id_session=$1',
        [idSession],
      );
    const original = await unchangedFields();
    expect(original).toHaveLength(1);
    await migrate('down');
    const absent: { column_name: string }[] = await source.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema=current_schema() AND table_name='user_sessions' AND column_name='remember_me'`,
    );
    expect(absent).toHaveLength(0);
    expect(await unchangedFields()).toEqual(original);

    await migrate('up');
    const restored: { remember_me: boolean | null }[] = await source.query(
      'SELECT remember_me FROM user_sessions WHERE id_session=$1',
      [idSession],
    );
    expect(restored).toEqual([{ remember_me: null }]);
    expect(await unchangedFields()).toEqual(original);
  });

  it.each([
    { rememberMe: undefined, hours: 12 },
    { rememberMe: false, hours: 12 },
    { rememberMe: true, hours: 30 * 24 },
  ])(
    'persists the $hours hour deadline for rememberMe=$rememberMe',
    async ({ rememberMe, hours }) => {
      const user = await fixtureUser();
      const issued = await login(user, rememberMe);
      const session = await rowFor(issued.refreshToken);
      const originalRefresh = claims(issued.refreshToken);
      const originalAccess = claims(issued.accessToken);
      expect(session.rememberMe).toBe(rememberMe ?? false);
      expect(issued.rememberMe).toBe(rememberMe ?? false);
      expect(session.expiresAt.getTime() - session.lastUsedAt.getTime()).toBe(hours * hour * 1000);
      expect(issued.sessionExpiresAt).toBe(session.expiresAt.toISOString());
      expect(session.refreshToken).toMatch(/^sha256:v1:/);
      expect(session.refreshToken).toBe(refreshDigest(issued.refreshToken));
      expect(originalRefresh.exp).toBe(Math.floor(session.expiresAt.getTime() / 1000));
      expect(originalAccess.exp).toBeLessThanOrEqual(originalRefresh.exp);
      await checkAccess(issued.accessToken).expect(200);

      // A valid refresh near its original deadline must also cap the replacement access token.
      const deadline = new Date(Math.floor(Date.now() / 1000) * 1000 + 60_000);
      await source.getRepository(UserSession).update(session.idSession, { expiresAt: deadline });
      const response = await post('refresh')
        .send({ refreshToken: issued.refreshToken })
        .expect(201);
      const rotated = credentialsFrom(response.body);
      const replacement = claims(rotated.refreshToken);
      expect(replacement.jti).not.toBe(originalRefresh.jti);
      expect(replacement.exp * 1000).toBe(deadline.getTime());
      expect(claims(rotated.accessToken).exp).toBe(replacement.exp);
      expect(rotated.sessionExpiresAt).toBe(deadline.toISOString());
      expect(await rowFor(rotated.refreshToken)).toMatchObject({
        refreshToken: refreshDigest(rotated.refreshToken),
        expiresAt: deadline,
      });
      await post('refresh').send({ refreshToken: issued.refreshToken }).expect(401);
      await post('refresh').send({ refreshToken: 'incorrect-refresh' }).expect(401);
      await source.getRepository(UserSession).update(session.idSession, { expiresAt: new Date(0) });
      await post('refresh').send({ refreshToken: rotated.refreshToken }).expect(401);
      await checkAccess(rotated.accessToken).expect(401);
    },
  );

  it.each([2, 3])('allows one usable successor for %i concurrent refreshes', async (count) => {
    const issued = await login(await fixtureUser());
    const results = await Promise.all(
      Array.from({ length: count }, () =>
        post('refresh').send({ refreshToken: issued.refreshToken }),
      ),
    );
    const winners = results.filter(({ status }) => status === 201);
    expect(winners).toHaveLength(1);
    expect(results.filter(({ status }) => status === 401 || status === 409)).toHaveLength(
      count - 1,
    );
    const successor = credentialsFrom(winners[0].body).refreshToken;
    expect((await rowFor(successor)).refreshToken).toBe(refreshDigest(successor));
    await post('refresh').send({ refreshToken: issued.refreshToken }).expect(401);
    await post('refresh').send({ refreshToken: successor }).expect(201);
  });

  it('caps signed JWT expiry when the clock crosses a second during issuance', async () => {
    const issued = await login(await fixtureUser());
    const started = Math.floor(Date.now() / 1000) * 1000;
    const deadline = new Date(started + 60_000);
    const idSession = claims(issued.refreshToken).idSession;
    await source.getRepository(UserSession).update(idSession, { expiresAt: deadline });
    const clock = jest.spyOn(Date, 'now').mockReturnValue(started);
    const signer = new JwtService();
    const signing = jest.spyOn(jwt, 'sign').mockImplementation((payload, options) => {
      clock.mockReturnValue(started + 1000);
      return signer.sign(payload, options);
    });
    try {
      const result = await auth.refreshToken(issued.refreshToken, true);
      if (!('refreshToken' in result)) throw new Error('Expected a rotated refresh token');
      expect(claims(result.accessToken).exp * 1000).toBeLessThanOrEqual(deadline.getTime());
      expect(claims(result.refreshToken).exp * 1000).toBeLessThanOrEqual(deadline.getTime());
    } finally {
      signing.mockRestore();
      clock.mockRestore();
    }
  });

  it('rotates two sessions of the same account and one of another account concurrently', async () => {
    const user = await fixtureUser();
    const other = await fixtureUser();
    const issued = await Promise.all([login(user), login(user), login(other)]);
    const rotated = await Promise.all(
      issued.map(async ({ refreshToken }) => {
        const response = await post('refresh').send({ refreshToken }).expect(201);
        const successor = credentialsFrom(response.body);
        expect(claims(successor.refreshToken).idSession).toBe(claims(refreshToken).idSession);
        expect((await rowFor(refreshToken)).refreshToken).toBe(
          refreshDigest(successor.refreshToken),
        );
        return successor;
      }),
    );
    expect(new Set(rotated.map(({ refreshToken }) => claims(refreshToken).idSession)).size).toBe(3);
    expect(rotated.map(({ accessToken }) => claims(accessToken).idUser)).toEqual([
      user.idUser,
      user.idUser,
      other.idUser,
    ]);
  });

  it('keeps the original digest after a PostgreSQL write failure', async () => {
    const issued = await login(await fixtureUser());
    const original = await rowFor(issued.refreshToken);
    await source.query(
      `ALTER TABLE user_sessions ADD CONSTRAINT rem32_rotation_failure
       CHECK (id_session <> ${original.idSession} OR last_used_at IS NULL) NOT VALID`,
    );
    try {
      await expect(auth.refreshToken(issued.refreshToken, true)).rejects.toMatchObject({
        driverError: { code: '23514' },
      });
      expect(await rowFor(issued.refreshToken)).toMatchObject({
        refreshToken: original.refreshToken,
        lastUsedAt: original.lastUsedAt,
        isActive: true,
      });
    } finally {
      await source.query('ALTER TABLE user_sessions DROP CONSTRAINT rem32_rotation_failure');
    }
    await post('refresh').send({ refreshToken: issued.refreshToken }).expect(201);
  });

  it.each(['logout', 'admin', 'deactivation'] as const)(
    'cannot rotate an in-flight refresh after %s commits',
    async (action) => {
      const user = await fixtureUser();
      const actor = await fixtureUser();
      const first = await login(user);
      const second = await login(user);
      const other = await login(actor);
      const sessionId = claims(first.refreshToken).idSession;
      const independentService = new SessionsService(source.getRepository(UserSession));
      let entered!: () => void;
      let resume!: () => void;
      const reachedCas = new Promise<void>((resolve) => {
        entered = resolve;
      });
      const gate = new Promise<void>((resolve) => {
        resume = resolve;
      });
      const spy = jest
        .spyOn(sessionsService, 'rotateRefresh')
        .mockImplementationOnce(async (...args) => {
          entered();
          await gate;
          return independentService.rotateRefresh(...args);
        });
      const rotating = auth.refreshToken(first.refreshToken, true);
      try {
        await Promise.race([reachedCas, rotating]);
        if (action === 'logout')
          await post('logout').send({ refreshToken: first.refreshToken }).expect(201);
        if (action === 'admin') await sessionsService.revokeSessionById(sessionId, actor);
        if (action === 'deactivation') await usersService.delete(user.idUser);
        resume();
        await expect(rotating).rejects.toBeInstanceOf(ConflictException);
      } finally {
        resume();
        await rotating.catch(() => undefined);
        spy.mockRestore();
      }
      expect(await rowFor(first.refreshToken)).toMatchObject({
        isActive: false,
        refreshToken: refreshDigest(first.refreshToken),
      });
      await post('refresh').send({ refreshToken: first.refreshToken }).expect(401);
      await checkAccess(first.accessToken).expect(401);
      await checkAccess(second.accessToken).expect(action === 'deactivation' ? 401 : 200);
      if (action !== 'deactivation') {
        await post('refresh').send({ refreshToken: second.refreshToken }).expect(201);
      }
      await post('refresh').send({ refreshToken: other.refreshToken }).expect(201);
      if (action === 'deactivation') {
        await usersService.reactivate(user.idUser);
        await checkAccess(second.accessToken).expect(401);
        await post('refresh').send({ refreshToken: second.refreshToken }).expect(401);
        await login(user);
      }
    },
  );

  it('revokes a session even when logout uses the proof consumed by rotation', async () => {
    const issued = await login(await fixtureUser(), true);
    const response = await post('refresh').send({ refreshToken: issued.refreshToken }).expect(201);
    const successor = credentialsFrom(response.body);
    expect(successor.sessionExpiresAt).toBe(
      new Date(claims(issued.refreshToken).exp * 1000).toISOString(),
    );
    await post('logout').send({ refreshToken: issued.refreshToken }).expect(201);
    await post('refresh').send({ refreshToken: successor.refreshToken }).expect(401);
    await checkAccess(successor.accessToken).expect(401);
  });

  it.each(['revoke-all', 'password'] as const)(
    'scopes %s to the target account',
    async (action) => {
      const user = await fixtureUser();
      const first = await login(user);
      const second = await login(user);
      const other = await login(await fixtureUser());
      const newPassword = 'Rem32-new-fixture-password!';
      if (action === 'revoke-all') await sessionsService.revokeAllSessions(user.idUser);
      else await usersService.update(user.idUser, { password: newPassword });
      for (const issued of [first, second]) {
        expect(await rowFor(issued.refreshToken)).toMatchObject({ isActive: false });
        await checkAccess(issued.accessToken).expect(401);
        await post('refresh').send({ refreshToken: issued.refreshToken }).expect(401);
      }
      await checkAccess(other.accessToken).expect(200);
      await post('refresh').send({ refreshToken: other.refreshToken }).expect(201);
      if (action === 'password') {
        await post('login').send({ username: user.username, password }).expect(401);
        await post('login').send({ username: user.username, password: newPassword }).expect(201);
      }
    },
  );

  it('upgrades a historical bcrypt token without a session id, jti or remembered flag', async () => {
    const user = await fixtureUser();
    const token = jwt.sign(
      { idUser: user.idUser },
      {
        secret: process.env.JWT_ACCESS_REFRESH,
        expiresIn: 3600,
      },
    );
    const expiry = new Date(claims(token).exp * 1000 - 60_000);
    const repo = source.getRepository(UserSession);
    const historical = await repo.save(
      repo.create({
        user,
        refreshToken: await bcrypt.hash(token, 4),
        expiresAt: expiry,
        rememberMe: null,
        isActive: true,
      }),
    );
    const response = await post('refresh').send({ refreshToken: token }).expect(201);
    const rotated = credentialsFrom(response.body);
    expect(rotated.rememberMe).toBeNull();
    expect(rotated.sessionExpiresAt).toBe(expiry.toISOString());
    expect(claims(rotated.refreshToken)).toMatchObject({
      idSession: historical.idSession,
      exp: expiry.getTime() / 1000,
    });
    expect(claims(rotated.refreshToken).jti).toMatch(/^[a-f0-9-]{36}$/);
    expect(await rowFor(rotated.refreshToken)).toMatchObject({
      rememberMe: null,
      refreshToken: refreshDigest(rotated.refreshToken),
      expiresAt: expiry,
    });
    await post('refresh').send({ refreshToken: token }).expect(401);
  });
});
