import { UserUpdateDto } from 'src/dtos/users/users-update.dto';
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { UserCreateDto } from 'src/dtos/users/users.dto';
import { User } from 'src/entities/users/users.entity';
import { Repository } from 'typeorm';

import * as bcrypt from 'bcrypt';
import { RolesService } from '../roles/roles.service';
import { UserQueryDto } from 'src/dtos/users/user-query.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    private readonly rolesService: RolesService,
  ) {}

  async getAll(query: UserQueryDto) {
    const { careerId, search, role, page = 1, limit = 20 } = query;
    const qb = this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.careers', 'career')
      .leftJoinAndSelect('user.roles', 'roles')
      .where('user.isActive = :isActive', { isActive: true });

    if (careerId) qb.andWhere('career.idCareer = :careerId', { careerId });

    if (search)
      qb.andWhere(
        `
        (user.username ILIKE :search
        OR user.name ILIKE :search
        OR user.lastname ILIKE :search
        OR user.ru ILIKE :search
        OR user.ci ILIKE :search)
        `,
        { search: `%${search}%` },
      );

    if (role) {
      const roles = role.split(',');

      qb.andWhere('roles.name IN (:...roles)', {
        roles,
      });
    }

    qb.skip((page - 1) * limit);
    qb.take(limit);
    const [data, total] = await qb.getManyAndCount();
    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async create(userCreateDto: UserCreateDto): Promise<User> {
    const user = await this.userRepository.findOne({
      where: [{ email: userCreateDto.email }, { username: userCreateDto.username }],
    });
    if (user) throw new BadRequestException('User already exists');

    const roles = await Promise.all(
      userCreateDto.roleNames.map(async (name) => {
        const role = await this.rolesService.getOneByName(name.toUpperCase());
        if (!role) throw new BadRequestException(`Role not found: ${name}`);
        return role;
      }),
    );
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(userCreateDto.password, salt);
    const userCreated = this.userRepository.create({
      ...userCreateDto,
      password: hash,
      roles,
    });
    userCreated.createdBy = 0;
    return this.userRepository.save(userCreated);
  }

  async getOneByEmail(email: string) {
    return this.userRepository.findOne({
      where: { email, isActive: true },
      relations: {
        roles: {
          permissions: true,
        },
      },
    });
  }

  async getOneByUsername(username: string) {
    return this.userRepository.findOne({
      where: { username, isActive: true },
      relations: {
        roles: {
          permissions: true,
        },
      },
    });
  }

  async getOneById(idUser: number) {
    return this.userRepository.findOne({
      where: { idUser, isActive: true },
      relations: {
        roles: {
          permissions: true,
        },
        enrollments: true,
      },
    });
  }

  async assignRoles(idUser: number, roleNames: string[]) {
    const user = await this.userRepository.findOne({
      where: { idUser, isActive: true },
      relations: ['roles'],
    });
    if (!user) throw new BadRequestException('User not found');
    for (const rn of roleNames) {
      const role = await this.rolesService.getOneByName(rn.toUpperCase());
      if (!role) throw new BadRequestException(`Role not found: ${rn}`);

      const alreadyAssigned = user.roles?.some((r) => r.name === rn);
      if (alreadyAssigned) throw new BadRequestException(`Role not found: ${rn}`);

      user.roles?.push(role);
    }

    user.updatedAt = new Date();
    return this.userRepository.save(user);
  }

  async delete(idUser: number) {
    const user = await this.userRepository.findOne({
      where: { idUser: idUser, isActive: true },
    });
    if (!user) throw new BadRequestException('User not found');
    user.isActive = false;
    return this.userRepository.save(user);
  }

  async reactivate(idUser: number) {
    const user = await this.userRepository.findOne({
      where: { idUser: idUser, isActive: false },
    });
    if (!user) throw new BadRequestException('User not found');
    user.isActive = true;
    return this.userRepository.save(user);
  }

  async update(idUser: number, dto: UserUpdateDto) {
    const user = await this.userRepository.findOne({ where: { idUser, isActive: true } });
    if (!user) throw new BadRequestException('User not found');
    for (const field of ['email', 'username'] as const) {
      if (dto[field] !== undefined) {
        const duplicate = await this.userRepository.findOne({ where: { [field]: dto[field] } });
        if (duplicate && duplicate.idUser !== idUser)
          throw new BadRequestException(`${field} already exists`);
      }
    }
    // Explicit fields keep role assignment behind its own permission.
    const { email, username, name, lastname, ci, ru, password } = dto;
    this.userRepository.merge(user, { email, username, name, lastname, ci, ru });
    if (password !== undefined) user.password = await bcrypt.hash(password, 10);
    const saved = await this.userRepository.save(user);
    return {
      idUser: saved.idUser,
      email: saved.email,
      username: saved.username,
      name: saved.name,
      lastname: saved.lastname,
      ci: saved.ci,
      ru: saved.ru,
      isActive: saved.isActive,
    };
  }
}
