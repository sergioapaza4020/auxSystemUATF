import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { RoleCreateDto } from 'src/dtos/roles/roles.dto';
import { Role } from 'src/entities/roles/roles.entity';
import { Repository } from 'typeorm';
import { PermissionsService } from '../permissions/permissions.service';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role) private readonly roleRepository: Repository<Role>,
    private readonly permissionsService: PermissionsService,
  ) {}

  async create(roleCreateDto: RoleCreateDto): Promise<Role> {
    const role = await this.getOneByName(roleCreateDto.name);
    if (role) throw new BadRequestException('Role already exists');

    const roleCreated = this.roleRepository.create(roleCreateDto);
    roleCreated.authorId = 0;
    roleCreated.createdAt = new Date();
    roleCreated.updatedAt = new Date();
    roleCreated.name = roleCreateDto.name.toUpperCase().trim().replace(/\s+/g, ' ');
    return this.roleRepository.save(roleCreated);
  }

  async getAll(): Promise<Role[]> {
    return this.roleRepository.find({
      where: { isActive: true },
    });
  }

  async getOneByName(name: string) {
    return this.roleRepository.findOne({
      where: { name, isActive: true },
    });
  }

  async getOneById(idRole: number) {
    return this.roleRepository.findOne({
      where: { idRole, isActive: true },
    });
  }

  async assignPermissions(idRole: number, permissionNames: string[]) {
    const role = await this.roleRepository.findOne({
      where: { idRole, isActive: true },
      relations: ['permissions'],
    });
    if (!role) throw new BadRequestException('Role not found');
    for (const pn of permissionNames) {
      const permission = await this.permissionsService.getOneByName(pn);
      if (!permission) throw new BadRequestException(`Permission not found: ${pn}`);

      const alreadyAssigned = role.permissions?.some((p) => p.name === pn);
      if (alreadyAssigned) throw new BadRequestException(`Permission already assigned: ${pn}`);

      role.permissions?.push(permission);
    }

    role.updatedAt = new Date();
    return this.roleRepository.save(role);
  }

  async delete(idRole: number) {
    const role = await this.roleRepository.findOne({
      where: { idRole, isActive: true },
    });
    if (!role) throw new BadRequestException('Role not found');
    role.updatedAt = new Date();
    role.deletedAt = new Date();
    role.isActive = false;
    return this.roleRepository.save(role);
  }

  async reactivate(idRole: number) {
    const role = await this.roleRepository.findOne({
      where: { idRole, isActive: false },
    });
    if (!role) throw new BadRequestException('Role not found');
    role.updatedAt = new Date();
    role.isActive = true;
    return this.roleRepository.save(role);
  }
}
