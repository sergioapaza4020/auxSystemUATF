import { Career } from 'src/entities/careers/careers.entity';
import { Role } from 'src/entities/roles/roles.entity';
import { User } from 'src/entities/users/users.entity';
import { In, Repository } from 'typeorm';
import { usersData } from '../data/users.data';
import { UserSeed } from '../interfaces/users.interface';
import { hashPassword } from '../utils/password.util';

export class UserSeeder {
  constructor(
    private readonly repository: Repository<User>,
    private readonly roleRepository: Repository<Role>,
    private readonly careerRepository: Repository<Career>,
  ) {}

  async run() {
    for (const item of usersData) {
      await this.create(item);
    }
  }

  async create(data: UserSeed) {
    const careers = await this.careerRepository.find({
      where: {
        name: In(data.careers),
      },
    });

    const roles = await this.roleRepository.find({
      where: {
        name: In(data.roles),
      },
    });

    if (roles.length !== data.roles.length) {
      throw new Error(`Some roles not found for user ${data.name}`);
    }

    const exists = await this.repository.findOne({
      where: {
        email: data.email,
      },
    });

    if (exists) {
      console.log(`User ${data.username} already exists`);
      return;
    }

    const user = this.repository.create({
      name: data.name,
      lastname: data.lastname,
      username: data.username,
      email: data.email,
      password: await hashPassword(data.password),
      ci: data.ci,
      ru: data.ru,
      careers,
      roles,
    });

    await this.repository.save(user);
  }
}
