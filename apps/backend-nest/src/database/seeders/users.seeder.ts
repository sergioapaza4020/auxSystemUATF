import { Career } from 'src/entities/careers/careers.entity';
import { Role } from 'src/entities/roles/roles.entity';
import { User } from 'src/entities/users/users.entity';
import { In, Repository } from 'typeorm';
import { usersData } from '../data/users.data';
import { UserSeed } from '../interfaces/users.interface';
import { hashPassword } from '../utils/password.util';
import { requireSeedReference, SeedDataError, SeedRowError } from '../utils/seed-integrity';

export class UserSeeder {
  constructor(
    private readonly repository: Repository<User>,
    private readonly roleRepository: Repository<Role>,
    private readonly careerRepository: Repository<Career>,
  ) {}

  async run() {
    for (const [index, item] of usersData.entries()) {
      try {
        await this.create(item);
      } catch (error: unknown) {
        throw new SeedRowError(index + 1, error);
      }
    }
  }

  async create(data: UserSeed) {
    const matches = await this.repository.find({
      where: [
        { email: data.email },
        { username: data.username },
        { ci: data.ci },
        ...(data.ru ? [{ ru: data.ru }] : []),
      ],
      withDeleted: true,
    });
    if (matches.length > 1)
      throw new SeedDataError(
        'Usuario: los identificadores pertenecen a cuentas diferentes; resolver el conflicto manualmente.',
      );
    const existing = matches[0];
    if (existing) {
      if (
        existing.ci !== data.ci ||
        existing.username !== data.username ||
        (data.ru && existing.ru && existing.ru !== data.ru)
      ) {
        throw new SeedDataError(
          'Usuario: conflicto de CI, RU o username; no se modificó la cuenta existente.',
        );
      }
      return existing; // Never reset passwords, names, email, career, status or roles.
    }
    if (data.careers.length > 1)
      throw new SeedDataError('Usuario: la entidad admite una sola carrera.');
    const career = data.careers.length
      ? await requireSeedReference(
          this.careerRepository,
          { name: data.careers[0] },
          'Carrera del usuario',
        )
      : undefined;
    if (new Set(data.roles).size !== data.roles.length || !data.roles.length) {
      throw new SeedDataError('Usuario: debe indicar roles sin duplicados.');
    }
    const roles = await this.roleRepository.find({ where: { name: In(data.roles) } });
    if (
      roles.length !== data.roles.length ||
      roles.some((role) => !role.isActive || role.deletedAt)
    ) {
      throw new SeedDataError(
        'Usuario: falta un rol activo requerido; ejecutar primero el seeder de roles.',
      );
    }

    const user = this.repository.create({
      name: data.name,
      lastname: data.lastname,
      username: data.username,
      email: data.email,
      password: await hashPassword(data.password),
      ci: data.ci,
      ru: data.ru,
      careers: career,
      roles,
    });

    return this.repository.save(user);
  }
}
