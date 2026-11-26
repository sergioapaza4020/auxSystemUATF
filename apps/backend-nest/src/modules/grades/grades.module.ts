import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GradesController } from 'src/controllers/grades/grades.controller';
import { Enrollment } from 'src/entities/enrollments/enrollments.entity';
import { GradeSchemeDetail } from 'src/entities/grade-scheme-detail/grade-scheme-detail.entity';
import { Grade } from 'src/entities/grades/grades.entity';
import { GradesService } from 'src/services/grades/grades.service';
import { EnrollmentsModule } from '../enrollments/enrollments.module';
import { Activity } from 'src/entities/activities/activity.entity';
import { ActivitiesModule } from '../activities/activities.module';
import { BulkOperationsModule } from '../bulk-operations/bulk-operations.module';
import { GradeImportController } from 'src/controllers/grades/grade-import.controller';
import { GradeImportService } from 'src/services/grades/grade-import.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Grade, Enrollment, GradeSchemeDetail, Activity]),
    EnrollmentsModule,
    ActivitiesModule,
    BulkOperationsModule,
  ],
  providers: [GradesService, GradeImportService],
  controllers: [GradesController, GradeImportController],
  exports: [GradesService],
})
export class GradesModule {}
