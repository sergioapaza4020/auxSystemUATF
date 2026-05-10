import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PermissionsController } from 'src/califications/controllers/permissions/permissions.controller';
import { Permission } from 'src/califications/entities/permissions/permissions.entity';
import { PermissionsService } from 'src/califications/services/permissions/permissions.service';

@Module({
  imports: [TypeOrmModule.forFeature([Permission])],
  providers: [PermissionsService],
  controllers: [PermissionsController],
  exports: [PermissionsService],
})
export class PermissionsModule {}
