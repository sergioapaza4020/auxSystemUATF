import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from 'src/controllers/users/users.controller';
import { User } from 'src/entities/users/users.entity';
import { UsersService } from 'src/services/users/users.service';
import { RolesModule } from '../roles/roles.module';
import { UserCourse } from 'src/entities/user-courses/user-courses.entity';
import { BulkOperationsModule } from '../bulk-operations/bulk-operations.module';
import { UserImportQueueModule } from '../bulk-operations/user-import-queue.module';
import { UserImportJobsService } from 'src/services/users/user-import-jobs.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserCourse]),
    RolesModule,
    BulkOperationsModule,
    UserImportQueueModule,
  ],
  providers: [UsersService, UserImportJobsService],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule {}
