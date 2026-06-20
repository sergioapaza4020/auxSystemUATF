import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserCoursesController } from 'src/controllers/user-courses/user-courses.controller';
import { UserCourse } from 'src/entities/user-courses/user-courses.entity';
import { UserCoursesService } from 'src/services/user-courses/user-courses.service';

@Module({
  imports: [TypeOrmModule.forFeature([UserCourse])],
  providers: [UserCoursesService],
  controllers: [UserCoursesController],
  exports: [UserCoursesService],
})
export class UserCoursesModule {}
