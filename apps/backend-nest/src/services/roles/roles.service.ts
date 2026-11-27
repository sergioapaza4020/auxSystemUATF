import { revokePrivilegeSessions } from '@common/utils/revoke-privilege-sessions';
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { RoleCreateDto } from 'src/dtos/roles/roles.dto';
import { Role } from 'src/entities/roles/roles.entity';
import { Repository } from 'typeorm';
import { PermissionsService } from '../permissions/permissions.service';
import { RoleUpdateDto } from 'src/dtos/roles/role-update.dto';
import { Permission } from 'src/entities/permissions/permissions.entity';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role) private readonly roleRepository: Repository<Role>,
    private readonly permissionsService: PermissionsService,
  ) {}

  async create(roleCreateDto: RoleCreateDto): Promise<Role> {
    const normalizedName = roleCreateDto.name.toUpperCase().trim().replace(/\s+/g, ' ');

    const role = await this.getOneByName(normalizedName);
    if (role) throw new BadRequestException('Ya existe un rol con estos datos.');

    const permissions: Permission[] = [];

    for (const permissionName of new Set(roleCreateDto.permissionNames)) {
      const permission = await this.permissionsService.getOneByName(permissionName);

      if (!permission) {
        throw new BadRequestException(`No encontramos el permiso «${permissionName}».`);
      }

      permissions.push(permission);
    }

    const roleCreated = this.roleRepository.create({
      name: normalizedName,
      description: roleCreateDto.description?.trim() || null,
      permissions,
    });
    roleCreated.createdBy = 0;

    return this.roleRepository.save(roleCreated);
  }

  async getAll(): Promise<Role[]> {
    return this.roleRepository.find({
      relations: {
        permissions: true,
      },
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
    if (!role) throw new BadRequestException('No encontramos el rol solicitado.');
    for (const pn of permissionNames) {
      const permission = await this.permissionsService.getOneByName(pn);
      if (!permission) throw new BadRequestException(`No encontramos el permiso «${pn}».`);

      const alreadyAssigned = role.permissions?.some((p) => p.name === pn);
      if (alreadyAssigned) throw new BadRequestException(`El rol ya tiene el permiso «${pn}».`);

      role.permissions?.push(permission);
    }

    role.updatedAt = new Date();
    return this.roleRepository.save(role);
  }

  async update(idRole: number, roleUpdateDto: RoleUpdateDto): Promise<Role> {
    const role = await this.roleRepository.findOne({
      where: {
        idRole,
        isActive: true,
      },
      relations: {
        permissions: true,
      },
    });

    if (!role) {
      throw new BadRequestException('No encontramos el rol solicitado.');
    }

    const normalizedName = roleUpdateDto.name.toUpperCase().trim().replace(/\s+/g, ' ');

    const existingRole = await this.roleRepository.findOne({
      where: {
        name: normalizedName,
        isActive: true,
      },
    });

    if (existingRole && existingRole.idRole !== idRole) {
      throw new BadRequestException('Ya existe un rol con estos datos.');
    }

    const permissions: Permission[] = [];

    for (const permissionName of roleUpdateDto.permissionNames) {
      const permission = await this.permissionsService.getOneByName(permissionName);

      if (!permission) {
        throw new BadRequestException(`No encontramos el permiso «${permissionName}».`);
      }

      permissions.push(permission);
    }

    role.name = normalizedName;
    role.description = roleUpdateDto.description?.trim() || null;
    role.permissions = permissions;
    role.updatedAt = new Date();

    return this.roleRepository.manager.transaction(async (manager) => {
      const saved = await manager.getRepository(Role).save(role);
      await revokePrivilegeSessions(manager, 'role', idRole);
      return saved;
    });
  }

  async delete(idRole: number) {
    const role = await this.roleRepository.findOne({
      where: { idRole, isActive: true },
    });
    if (!role) throw new BadRequestException('No encontramos el rol solicitado.');
    role.isActive = false;
    return this.roleRepository.manager.transaction(async (manager) => {
      const saved = await manager.getRepository(Role).save(role);
      await revokePrivilegeSessions(manager, 'role', idRole);
      return saved;
    });
  }

  async reactivate(idRole: number) {
    const role = await this.roleRepository.findOne({
      where: { idRole, isActive: false },
    });
    if (!role) throw new BadRequestException('No encontramos el rol solicitado.');
    role.isActive = true;
    return this.roleRepository.save(role);
  }
}
