import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActivitiesController } from 'src/controllers/activities/activities.controller';
import { Activity } from 'src/entities/activities/activity.entity';
import { Enrollment } from 'src/entities/enrollments/enrollments.entity';
import { GradeSchemeDetail } from 'src/entities/grade-scheme-detail/grade-scheme-detail.entity';
import { ActivitiesService } from 'src/services/activities/activities.service';

@Module({
  imports: [TypeOrmModule.forFeature([Activity, GradeSchemeDetail, Enrollment])],
  providers: [ActivitiesService],
  controllers: [ActivitiesController],
  exports: [ActivitiesService],
})
export class ActivitiesModule {}
