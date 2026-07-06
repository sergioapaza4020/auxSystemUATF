import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { PermissionCreateDto } from 'src/dtos/permissions/permissions.dto';
import { PermissionsService } from 'src/services/permissions/permissions.service';
import { CurrentUser } from '@core/decorators/current-user/current-user.decorator';
import { User } from 'src/entities/users/users.entity';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permissions } from '@core/decorators/permissions/permissions.decorator';

@ApiBearerAuth('acess-token')
@Controller('permissions')
@ApiTags('Permissions')
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Permissions('permission.get-all')
  @Get()
  async getAll() {
    return this.permissionsService.getAll();
  }

  @Permissions('permission.create')
  @Post()
  async create(@Body() permissionCreateDto: PermissionCreateDto, @CurrentUser() user: User) {
    return this.permissionsService.create(permissionCreateDto, user.idUser);
  }

  @Permissions('permission.get-one-by-name')
  @Get('name/:name')
  async getOneByName(@Param('name') name: string) {
    return this.permissionsService.getOneByName(name);
  }

  @Permissions('permission.get-one-by-id')
  @Get('id/:idPermission')
  async getOneById(@Param('idPermission') idPermission: number) {
    return this.permissionsService.getOneById(idPermission);
  }

  @Permissions('permission.delete')
  @Delete(':idPermission')
  async delete(@Param('idPermission') idPermission: number) {
    return this.permissionsService.delete(idPermission);
  }

  @Permissions('permission.reactivate')
  @Patch('reactivate/:idPermission')
  async reactivate(@Param('idPermission') idPermission: number) {
    return this.permissionsService.reactivate(idPermission);
  }
}
