import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { UserCreateDto } from 'src/dtos/users/users.dto';
import { User } from 'src/entities/users/users.entity';
import { Repository } from 'typeorm';

import * as bcrypt from 'bcrypt';
import { RolesService } from '../roles/roles.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    private readonly rolesService: RolesService,
  ) {}

  async getAll(): Promise<User[]> {
    return this.userRepository.find({
      where: { isActive: true },
      relations: {
        roles: {
          permissions: true,
        },
      },
    });
  }

  async create(userCreateDto: UserCreateDto): Promise<User> {
    const user =
      (await this.getOneByEmail(userCreateDto.email)) ||
      (await this.getOneByUsername(userCreateDto.username));
    if (user) throw new BadRequestException('User already exists');

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(userCreateDto.password, salt);
    const userCreated = this.userRepository.create({
      ...userCreateDto,
      password: hash,
    });
    userCreated.authorId = 0;
    userCreated.createdAt = new Date();
    userCreated.updatedAt = new Date();
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
      if (alreadyAssigned)
        throw new BadRequestException(`Role not found: ${rn}`);

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
    user.updatedAt = new Date();
    user.deletedAt = new Date();
    user.isActive = false;
    return this.userRepository.save(user);
  }

  async reactivate(idUser: number) {
    const user = await this.userRepository.findOne({
      where: { idUser: idUser, isActive: false },
    });
    if (!user) throw new BadRequestException('User not found');
    user.updatedAt = new Date();
    user.isActive = true;
    return this.userRepository.save(user);
  }
}
