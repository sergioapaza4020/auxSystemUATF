import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesController } from 'src/califications/controllers/roles/roles.controller';
import { Role } from 'src/califications/entities/roles/roles.entity';
import { RolesService } from 'src/califications/services/roles/roles.service';

@Module({
  imports: [TypeOrmModule.forFeature([Role])],
  providers: [RolesService],
  controllers: [RolesController],
  exports: [RolesService],
})
export class RolesModule {}
