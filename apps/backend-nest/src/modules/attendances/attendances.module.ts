import { APP_INTERCEPTOR } from '@nestjs/core';
import { BulkOperationsModule } from '../bulk-operations/bulk-operations.module';
import { AttendanceImportController } from 'src/controllers/attendances/attendance-import.controller';
import { AttendanceImportService } from 'src/services/attendances/attendance-import.service';
import { UserImportQueueModule } from '../bulk-operations/user-import-queue.module';
import { AttendanceRateLimitService } from 'src/services/attendances/attendance-rate-limit.service';
import { AttendanceRateLimitInterceptor } from 'src/services/attendances/attendance-rate-limit.interceptor';
import { AttendanceCombinedAuthorization } from 'src/entities/attendance/attendance-combined-authorization.entity';
import { AttendanceAuditEvent } from 'src/entities/attendance/attendance-audit-event.entity';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AttendancesController } from 'src/controllers/attendances/attendances.controller';
import { AttendanceSession } from 'src/entities/attendance/attendance-session.entity';
import { Attendance } from 'src/entities/attendance/attendance.entity';

import { Enrollment } from 'src/entities/enrollments/enrollments.entity';

import { AttendancesService } from 'src/services/attendances/attendances.service';
import { AttendanceQrTokenService } from 'src/services/attendances/attendance-qr-token.service';

@Module({
  imports: [
    BulkOperationsModule,
    UserImportQueueModule,
    TypeOrmModule.forFeature([
      Attendance,
      AttendanceSession,
      Enrollment,
      AttendanceCombinedAuthorization,
      AttendanceAuditEvent,
    ]),
  ],
  providers: [
    AttendanceImportService,
    AttendancesService,
    AttendanceQrTokenService,
    AttendanceRateLimitService,
    { provide: APP_INTERCEPTOR, useClass: AttendanceRateLimitInterceptor },
  ],
  controllers: [AttendancesController, AttendanceImportController],
  exports: [AttendancesService],
})
export class AttendancesModule {}
