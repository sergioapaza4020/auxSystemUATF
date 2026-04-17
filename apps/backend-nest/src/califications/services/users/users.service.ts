import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { UserCreateDto } from 'src/califications/dtos/users/users.dto';
import { User } from 'src/califications/entities/users/users.entity';
import { Repository } from 'typeorm';

import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
  ) {}

  async create(userCreateDto: UserCreateDto): Promise<User> {
    const user = await this.getOneByEmail(userCreateDto.email);
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

  async getAll(): Promise<User[]> {
    return this.userRepository.find({ where: { isActive: true } });
  }

  async getOneByEmail(email: string) {
    return this.userRepository.findOne({ where: { email } });
  }

  async getOneByUsername(username: string) {
    return this.userRepository.findOne({ where: { username } });
  }

  async getOneById(idUser: number) {
    return this.userRepository.findOne({ where: { idUser } });
  }

  async delete(idUser: number) {
    const user = await this.userRepository.findOne({
      where: { idUser: idUser },
    });
    if (!user) throw new BadRequestException('User not found');
    user.updatedAt = new Date();
    user.deletedAt = new Date();
    return this.userRepository.save(user);
  }
}
