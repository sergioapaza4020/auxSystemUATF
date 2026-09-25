import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AttendancesController } from 'src/controllers/attendances/attendances.controller';
import { AttendanceSession } from 'src/entities/attendance/attendance-session.entity';
import { Attendance } from 'src/entities/attendance/attendance.entity';

import { Enrollment } from 'src/entities/enrollments/enrollments.entity';

import { AttendancesService } from 'src/services/attendances/attendances.service';

@Module({
  imports: [TypeOrmModule.forFeature([Attendance, AttendanceSession, Enrollment])],
  providers: [AttendancesService],
  controllers: [AttendancesController],
  exports: [AttendancesService],
})
export class AttendancesModule {}
