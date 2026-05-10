import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { RoleCreateDto } from 'src/califications/dtos/roles/roles.dto';
import { RolesService } from 'src/califications/services/roles/roles.service';

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

  @Delete(':idRole')
  async delete(@Param('idRole') idRole: number) {
    return this.rolesService.delete(idRole);
  }

  @Patch('reactivate/:idRole')
  async reactivate(@Param('idRole') idRole: number) {
    return this.rolesService.reactivate(idRole);
  }
}
