import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GradeSchemesController } from 'src/controllers/grade-schemes/grade-schemes.controller';
import { Course } from 'src/entities/courses/courses.entity';
import { Enrollment } from 'src/entities/enrollments/enrollments.entity';
import { GradeSchemeDetail } from 'src/entities/grade-scheme-detail/grade-scheme-detail.entity';
import { GradeScheme } from 'src/entities/grade-schemes/grade-schemes.entity';
import { GradeSchemesService } from 'src/services/grade-schemes/grade-schemes.service';

@Module({
  imports: [TypeOrmModule.forFeature([GradeScheme, GradeSchemeDetail, Enrollment, Course])],
  providers: [GradeSchemesService],
  controllers: [GradeSchemesController],
  exports: [GradeSchemesService],
})
export class GradeSchemesModule {}
