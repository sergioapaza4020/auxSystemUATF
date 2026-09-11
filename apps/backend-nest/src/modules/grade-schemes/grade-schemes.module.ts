import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssistantGradeSchemesController } from 'src/controllers/grade-schemes/assistant-grade-schemes.controller';
import { GradeSchemesController } from 'src/controllers/grade-schemes/grade-schemes.controller';
import { Course } from 'src/entities/courses/courses.entity';
import { Enrollment } from 'src/entities/enrollments/enrollments.entity';
import { GradeSchemeDetail } from 'src/entities/grade-scheme-detail/grade-scheme-detail.entity';
import { GradeScheme } from 'src/entities/grade-schemes/grade-schemes.entity';
import { AssistantGradeSchemesService } from 'src/services/grade-schemes/assistant-grade-schemes.service';
import { GradeSchemesService } from 'src/services/grade-schemes/grade-schemes.service';

@Module({
  imports: [TypeOrmModule.forFeature([GradeScheme, GradeSchemeDetail, Enrollment, Course])],
  providers: [GradeSchemesService, AssistantGradeSchemesService],
  controllers: [GradeSchemesController, AssistantGradeSchemesController],
  exports: [GradeSchemesService, AssistantGradeSchemesService],
})
export class GradeSchemesModule {}
