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
import { ProfileAvatarController } from 'src/controllers/users/profile-avatar.controller';
import { ProfileAvatarService } from 'src/services/users/profile-avatar.service';
import { AvatarStorage } from 'src/services/users/avatar-storage.service';
import { MailModule } from '../mail/mail.module';
import { EmailChangeRequest } from 'src/entities/email-change-requests/email-change-request.entity';
import { EmailChangeService } from 'src/services/users/email-change.service';
import { EmailChangeController } from 'src/controllers/users/email-change.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserCourse, EmailChangeRequest]),
    MailModule,
    RolesModule,
    BulkOperationsModule,
    UserImportQueueModule,
  ],
  providers: [
    UsersService,
    UserImportJobsService,
    ProfileAvatarService,
    AvatarStorage,
    EmailChangeService,
  ],
  controllers: [UsersController, ProfileAvatarController, EmailChangeController],
  exports: [UsersService],
})
export class UsersModule {}
