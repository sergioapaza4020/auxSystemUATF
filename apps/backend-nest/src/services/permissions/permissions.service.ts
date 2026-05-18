import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PermissionCreateDto } from 'src/dtos/permissions/permissions.dto';
import { Permission } from 'src/entities/permissions/permissions.entity';
import { Repository } from 'typeorm';

@Injectable()
export class PermissionsService {
  constructor(
    @InjectRepository(Permission)
    private readonly permissionRepository: Repository<Permission>,
  ) {}

  async create(permissionCreateDto: PermissionCreateDto): Promise<Permission> {
    const permission = await this.getOneByName(permissionCreateDto.name);
    if (permission) throw new BadRequestException('Permission already exists');

    const permissionCreated =
      this.permissionRepository.create(permissionCreateDto);
    permissionCreated.authorId = 0;
    permissionCreated.createdAt = new Date();
    permissionCreated.updatedAt = new Date();
    permissionCreated.name = permissionCreateDto.name
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '.');
    return this.permissionRepository.save(permissionCreated);
  }

  async getAll(): Promise<Permission[]> {
    return this.permissionRepository.find({ where: { isActive: true } });
  }

  async getOneByName(name: string) {
    return this.permissionRepository.findOne({
      where: { name, isActive: true },
    });
  }

  async getOneById(idPermission: number) {
    return this.permissionRepository.findOne({
      where: { idPermission, isActive: true },
    });
  }

  async delete(idPermission: number) {
    const permission = await this.permissionRepository.findOne({
      where: { idPermission, isActive: true },
    });
    if (!permission) throw new BadRequestException('Permission not found');
    permission.updatedAt = new Date();
    permission.deletedAt = new Date();
    permission.isActive = false;
    return this.permissionRepository.save(permission);
  }

  async reactivate(idPermission: number) {
    const permission = await this.permissionRepository.findOne({
      where: { idPermission, isActive: false },
    });
    if (!permission) throw new BadRequestException('Permission not found');
    permission.updatedAt = new Date();
    permission.deletedAt = new Date();
    permission.isActive = true;
    return this.permissionRepository.save(permission);
  }
}
