import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EnrollmentsController } from 'src/controllers/enrollments/enrollments.controller';
import { Enrollment } from 'src/entities/enrollments/enrollments.entity';
import { EnrollmentsService } from 'src/services/enrollments/enrollments.service';
import { UsersModule } from '../users/users.module';
import { SemestersModule } from '../semesters/semesters.module';
import { CoursesModule } from '../courses/courses.module';

@Module({
  imports: [TypeOrmModule.forFeature([Enrollment]), UsersModule, SemestersModule, CoursesModule],
  providers: [EnrollmentsService],
  controllers: [EnrollmentsController],
  exports: [EnrollmentsService],
})
export class EnrollmentsModule {}
