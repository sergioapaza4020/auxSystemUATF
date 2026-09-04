import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GradesController } from 'src/controllers/grades/grades.controller';
import { Enrollment } from 'src/entities/enrollments/enrollments.entity';
import { GradeSchemeDetail } from 'src/entities/grade-scheme-detail/grade-scheme-detail.entity';
import { Grade } from 'src/entities/grades/grades.entity';
import { GradesService } from 'src/services/grades/grades.service';

@Module({
  imports: [TypeOrmModule.forFeature([Grade, Enrollment, GradeSchemeDetail])],
  providers: [GradesService],
  controllers: [GradesController],
  exports: [GradesService],
})
export class GradesModule {}
