import { Public } from '@core/decorators/public/public.decorator';
import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { RolesAssignPermissionsDto } from 'src/dtos/roles/role-assign-permissions.dto';
import { RoleCreateDto } from 'src/dtos/roles/roles.dto';
import { RolesService } from 'src/services/roles/roles.service';

@Public()
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  async getAll() {
    return this.rolesService.getAll();
  }

  @Post()
  async create(@Body() roleCreateDto: RoleCreateDto) {
    return this.rolesService.create(roleCreateDto);
  }

  @Get('name/:name')
  async getOneByName(@Param('name') name: string) {
    return this.rolesService.getOneByName(name);
  }

  @Get('id/:idRole')
  async getOneById(@Param('idRole') idRole: number) {
    return this.rolesService.getOneById(idRole);
  }

  @Patch('assign-permissions/:idRole')
  async assignPermissions(
    @Param('idRole', ParseIntPipe) idRole: number,
    @Body() roleAssignPermissionDto: RolesAssignPermissionsDto,
  ) {
    return this.rolesService.assignPermissions(idRole, roleAssignPermissionDto.permissionNames);
  }

  @Delete(':idRole')
  async delete(@Param('idRole') idRole: number) {
    return this.rolesService.delete(idRole);
  }

  @Patch('reactivate/:idRole')
  async reactivate(@Param('idRole') idRole: number) {
    return this.rolesService.reactivate(idRole);
  }
}
