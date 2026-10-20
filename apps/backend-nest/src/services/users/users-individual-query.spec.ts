import { DataSource } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { User } from 'src/entities/users/users.entity';
import { RolesService } from '../roles/roles.service';
import { BulkOperationsService } from '../bulk-operations/bulk-operations.service';
import { SessionsService } from '../sessions/sessions.service';
import { AuthService } from '../auth/auth.service';
import { UsersService } from './users.service';

class MetadataSource extends DataSource {
  async prepare() {
    await this.buildMetadatas();
  }
}

describe('Individual user and session queries', () => {
  const source = new MetadataSource({
    type: 'postgres',
    entities: [__dirname + '/../../entities/**/*.entity.ts'],
  });
  beforeAll(async () => source.prepare());

  function fixture() {
    const user = {
      idUser: 1,
      name: 'Ana',
      lastname: 'Pérez',
      username: 'ana',
      email: 'ana@example.com',
      roles: [
        {
          name: 'SUPERADMIN',
          permissions: [{ name: 'users.update' }, { name: 'grade.get-by-enrollment' }],
        },
        {
          name: 'ASSISTANT',
          permissions: [{ name: 'grade.get-by-enrollment' }, { name: 'attendance.student.get' }],
        },
      ],
    } as User;
    const repository = source.getRepository(User);
    const find = jest.spyOn(repository, 'findOne').mockResolvedValue(user);
    const users = new UsersService(repository, {} as RolesService, {} as BulkOperationsService);
    const auth = new AuthService({} as JwtService, users, {} as SessionsService);
    return { user, repository, find, users, auth };
  }

  it('keeps admin detail roles and permissions without loading enrollments or password', async () => {
    const f = fixture();
    expect(await f.users.getOneById(1)).toBe(f.user);
    const options = f.find.mock.calls[0][0];
    expect(options).toEqual({
      where: { idUser: 1, isActive: true },
      relations: { roles: { permissions: true } },
    });
    const sql = f.repository.createQueryBuilder('user').setFindOptions(options).getSql();
    expect(sql).toContain('"roles"');
    expect(sql).toContain('"permissions"');
    expect(sql).not.toContain('"enrollments"');
    expect(sql).not.toContain('"password"');
  });

  it('preserves all effective permissions and SUPERADMIN in /auth/me without enrollment data', async () => {
    const f = fixture();
    const session = await f.auth.getSession(1, 9);
    expect(session).toEqual({
      idUser: 1,
      idSession: 9,
      name: 'Ana',
      username: 'ana',
      email: 'ana@example.com',
      roles: ['SUPERADMIN', 'ASSISTANT'],
      permissions: ['users.update', 'grade.get-by-enrollment', 'attendance.student.get'],
    });
    expect(session).not.toHaveProperty('password');
    expect(session).not.toHaveProperty('enrollments');
    expect(f.find).toHaveBeenCalledWith(
      expect.objectContaining({ relations: { roles: { permissions: true } } }),
    );
  });

  it('rejects a missing or inactive session user', async () => {
    const f = fixture();
    f.find.mockResolvedValue(null);
    await expect(f.auth.getSession(1, 9)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('still explicitly selects the password only for authentication', async () => {
    const f = fixture();
    const query = f.repository.createQueryBuilder('user');
    jest.spyOn(f.repository, 'createQueryBuilder').mockReturnValue(query);
    jest.spyOn(query, 'getOne').mockResolvedValue(f.user);
    await f.users.getForAuthentication('ana');
    expect(query.getSql()).toContain('"user"."password"');
    expect(query.getSql()).not.toContain('"enrollments"');
    expect(query.getParameters()).toMatchObject({ username: 'ana', isActive: true });
  });
  afterEach(() => jest.restoreAllMocks());
});
