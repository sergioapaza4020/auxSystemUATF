import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { Public } from '@core/decorators/public/public.decorator';
import { PermissionCreateDto } from 'src/dtos/permissions/permissions.dto';
import { PermissionsService } from 'src/services/permissions/permissions.service';

@Public()
@Controller('permissions')
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Get()
  async getAll() {
    return this.permissionsService.getAll();
  }

  @Post()
  async create(@Body() permissionCreateDto: PermissionCreateDto) {
    return this.permissionsService.create(permissionCreateDto);
  }

  @Get('name/:name')
  async getOneByName(@Param('name') name: string) {
    return this.permissionsService.getOneByName(name);
  }

  @Get('id/:idPermission')
  async getOneById(@Param('idPermission') idPermission: number) {
    return this.permissionsService.getOneById(idPermission);
  }

  @Delete(':idPermission')
  async delete(@Param('idPermission') idPermission: number) {
    return this.permissionsService.delete(idPermission);
  }

  @Patch('reactivate/:idPermission')
  async reactivate(@Param('idPermission') idPermission: number) {
    return this.permissionsService.reactivate(idPermission);
  }
}
