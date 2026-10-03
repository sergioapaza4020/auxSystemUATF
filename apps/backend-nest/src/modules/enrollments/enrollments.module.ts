import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EnrollmentsController } from 'src/controllers/enrollments/enrollments.controller';
import { Enrollment } from 'src/entities/enrollments/enrollments.entity';
import { EnrollmentsService } from 'src/services/enrollments/enrollments.service';
import { UsersModule } from '../users/users.module';
import { SemestersModule } from '../semesters/semesters.module';
import { CoursesModule } from '../courses/courses.module';
import { EnrollmentImportService } from 'src/services/enrollments/enrollment-import.service';
import { EnrollmentImportController } from 'src/controllers/enrollments/enrollment-import.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Enrollment]), UsersModule, SemestersModule, CoursesModule],
  providers: [EnrollmentsService, EnrollmentImportService],
  controllers: [EnrollmentImportController, EnrollmentsController],
  exports: [EnrollmentsService],
})
export class EnrollmentsModule {}
