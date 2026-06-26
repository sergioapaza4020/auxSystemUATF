import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from 'src/controllers/users/users.controller';
import { User } from 'src/entities/users/users.entity';
import { UsersService } from 'src/services/users/users.service';
import { RolesModule } from '../roles/roles.module';
import { UserCourse } from 'src/entities/user-courses/user-courses.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, UserCourse]), RolesModule],
  providers: [UsersService],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule {}
