import { AttendanceSessionUpdateDto } from 'src/dtos/attendances/attendance-session-update.dto';
import type { JwtPayload } from '@common/types/jwt-payload.type';

import { CurrentUser } from '@core/decorators/current-user/current-user.decorator';
import { Permissions } from '@core/decorators/permissions/permissions.decorator';

import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';

import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { AttendanceSessionCreateDto } from 'src/dtos/attendances/attendance-session-create.dto';
import { AttendanceSaveDto } from 'src/dtos/attendances/attendance-save.dto';

import { AttendancesService } from 'src/services/attendances/attendances.service';

@ApiBearerAuth('access-token')
@Controller('attendances')
@ApiTags('Attendances')
export class AttendancesController {
  constructor(private readonly attendancesService: AttendancesService) {}

  @Permissions('attendance.session.create')
  @Post('sessions')
  async createSession(@CurrentUser() user: JwtPayload, @Body() dto: AttendanceSessionCreateDto) {
    return this.attendancesService.createSession(user.idUser, dto);
  }

  @Permissions('attendance.session.get-by-enrollment')
  @Get('sessions/enrollment/:idEnrollment')
  async getSessionsByEnrollment(
    @CurrentUser() user: JwtPayload,
    @Param('idEnrollment', ParseIntPipe)
    idEnrollment: number,
  ) {
    return this.attendancesService.getSessionsByEnrollment(user.idUser, idEnrollment);
  }

  @Permissions('attendance.session.get-one')
  @Get('sessions/:idSession')
  async getSession(
    @CurrentUser() user: JwtPayload,
    @Param('idSession', ParseIntPipe)
    idSession: number,
  ) {
    return this.attendancesService.getSession(user.idUser, idSession);
  }

  @Permissions('attendance.save')
  @Post('sessions/:idSession')
  async saveAttendances(
    @CurrentUser() user: JwtPayload,
    @Param('idSession', ParseIntPipe)
    idSession: number,
    @Body() dto: AttendanceSaveDto,
  ) {
    return this.attendancesService.saveAttendances(user.idUser, idSession, dto);
  }

  @Permissions('attendance.student.get')
  @Get('student/:idEnrollment')
  async getStudentAttendance(
    @CurrentUser() user: JwtPayload,
    @Param('idEnrollment', ParseIntPipe) idEnrollment: number,
  ) {
    return this.attendancesService.getStudentAttendance(user.idUser, idEnrollment);
  }

  @Permissions('attendance.session.update')
  @Patch('sessions/:idSession')
  async updateSession(
    @CurrentUser() user: JwtPayload,
    @Param('idSession', ParseIntPipe) idSession: number,
    @Body() dto: AttendanceSessionUpdateDto,
  ) {
    return this.attendancesService.updateSession(user.idUser, idSession, dto);
  }

  @Permissions('attendance.session.delete')
  @Delete('sessions/:idSession')
  async deleteSession(
    @CurrentUser() user: JwtPayload,
    @Param('idSession', ParseIntPipe) idSession: number,
  ) {
    return this.attendancesService.deleteSession(user.idUser, idSession);
  }

  @Permissions('attendance.delete')
  @Delete('sessions/:idSession/students/:idEnrollment')
  async deleteAttendance(
    @CurrentUser() user: JwtPayload,
    @Param('idSession', ParseIntPipe) idSession: number,
    @Param('idEnrollment', ParseIntPipe) idEnrollment: number,
  ) {
    return this.attendancesService.deleteAttendance(user.idUser, idSession, idEnrollment);
  }
}
