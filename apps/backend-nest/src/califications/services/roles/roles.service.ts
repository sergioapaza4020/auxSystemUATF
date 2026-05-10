import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { RoleCreateDto } from 'src/califications/dtos/roles/roles.dto';
import { Role } from 'src/califications/entities/roles/roles.entity';
import { Repository } from 'typeorm';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role) private readonly roleRepository: Repository<Role>,
  ) {}

  async create(roleCreateDto: RoleCreateDto): Promise<Role> {
    const role = await this.getOneByName(roleCreateDto.name);
    if (role) throw new BadRequestException('Role already exists');

    const userCreated = this.roleRepository.create(roleCreateDto);
    userCreated.authorId = 0;
    userCreated.createdAt = new Date();
    userCreated.updatedAt = new Date();
    userCreated.name = roleCreateDto.name.toUpperCase();
    return this.roleRepository.save(userCreated);
  }

  async getAll(): Promise<Role[]> {
    return this.roleRepository.find({ where: { isActive: true } });
  }

  async getOneByName(name: string) {
    return this.roleRepository.findOne({ where: { name } });
  }

  async getOneById(idRole: number) {
    return this.roleRepository.findOne({ where: { idRole } });
  }

  async delete(idRole: number) {
    const user = await this.roleRepository.findOne({
      where: { idRole: idRole, isActive: true },
    });
    if (!user) throw new BadRequestException('Role not found');
    user.updatedAt = new Date();
    user.deletedAt = new Date();
    user.isActive = false;
    return this.roleRepository.save(user);
  }

  async reactivate(idRole: number) {
    const user = await this.roleRepository.findOne({
      where: { idRole: idRole, isActive: false },
    });
    if (!user) throw new BadRequestException('Role not found');
    user.updatedAt = new Date();
    user.isActive = true;
    return this.roleRepository.save(user);
  }
}
