import { StudentRosterQueryDto } from 'src/dtos/enrollments/student-roster-query.dto';
import { StudentAttendanceResponseDto } from 'src/dtos/attendances/student-attendance-response.dto';
import { AttendanceSessionUpdateDto } from 'src/dtos/attendances/attendance-session-update.dto';
import { Query } from '@nestjs/common';
import { AttendanceHistoryQueryDto } from 'src/dtos/attendances/attendance-history-query.dto';
import type { JwtPayload } from '@common/types/jwt-payload.type';

import { CurrentUser } from '@core/decorators/current-user/current-user.decorator';
import { Permissions } from '@core/decorators/permissions/permissions.decorator';

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseFilters,
  HttpStatus,
  Header,
  HttpCode,
} from '@nestjs/common';
import type { Request } from 'express';

import { ApiBearerAuth, ApiTags, ApiOkResponse, ApiCreatedResponse } from '@nestjs/swagger';

import { AttendanceSessionCreateDto } from 'src/dtos/attendances/attendance-session-create.dto';
import { AttendanceSaveDto } from 'src/dtos/attendances/attendance-save.dto';
import { AttendanceGeolocationConfigDto } from 'src/dtos/attendances/attendance-geolocation-config.dto';
import { AttendanceCheckInDto } from 'src/dtos/attendances/attendance-check-in.dto';
import { AttendanceCheckInResponseDto } from 'src/dtos/attendances/attendance-check-in-response.dto';
import { StudentAttendanceSessionDto } from 'src/dtos/attendances/student-attendance-session.dto';
import { AttendanceCheckInException } from '@common/errors/attendance-check-in.exception';
import { AttendanceCheckInCode } from '@common/enums/attendanceCheckInCode';
import { AttendanceCheckInValidationFilter } from '@core/filters/http-exception/attendance-check-in-validation.filter';
import { AttendanceQrValidationFilter } from '@core/filters/http-exception/attendance-qr-validation.filter';
import {
  AttendanceQrConfigDto,
  AttendanceQrTokenDto,
} from 'src/dtos/attendances/attendance-qr.dto';
import {
  attendanceSessionResponse,
  AttendanceSessionLifecycleResponseDto,
} from 'src/dtos/attendances/attendance-session-lifecycle-response.dto';

import { AttendancesService } from 'src/services/attendances/attendances.service';

@ApiBearerAuth('access-token')
@Controller('attendances')
@ApiTags('Attendances')
export class AttendancesController {
  constructor(private readonly attendancesService: AttendancesService) {}

  private qrId(idSession: number) {
    if (!Number.isSafeInteger(idSession) || idSession < 1 || idSession > 2147483647)
      throw new AttendanceCheckInException(
        AttendanceCheckInCode.QR_TOKEN_INVALID,
        HttpStatus.BAD_REQUEST,
      );
  }

  private strictQrBody(request: Request, keys: string[]) {
    const body: unknown = request.body;
    if (
      !body ||
      typeof body !== 'object' ||
      Array.isArray(body) ||
      Object.keys(body).some((key) => !keys.includes(key))
    )
      throw new AttendanceCheckInException(
        AttendanceCheckInCode.QR_TOKEN_INVALID,
        HttpStatus.BAD_REQUEST,
      );
  }

  @Permissions('attendance.qr.get')
  @Get('sessions/:idSession/qr')
  @Header('Cache-Control', 'no-store')
  @UseFilters(AttendanceQrValidationFilter)
  getQr(@CurrentUser() user: JwtPayload, @Param('idSession', ParseIntPipe) idSession: number) {
    this.qrId(idSession);
    return this.attendancesService.getQr(user.idUser, idSession);
  }

  @Permissions('attendance.session.update')
  @Patch('sessions/:idSession/qr')
  @Header('Cache-Control', 'no-store')
  configureQr(
    @CurrentUser() user: JwtPayload,
    @Param('idSession', ParseIntPipe) idSession: number,
    @Body() dto: AttendanceQrConfigDto,
    @Req() request: Request,
  ) {
    this.strictQrBody(request, ['startsAt', 'endsAt']);
    this.qrId(idSession);
    return this.attendancesService.configureQr(user.idUser, idSession, dto);
  }

  @Permissions('attendance.qr.check-in')
  @Post('sessions/:idSession/qr-check-in')
  @Header('Cache-Control', 'no-store')
  @UseFilters(AttendanceQrValidationFilter)
  checkInQr(
    @CurrentUser() user: JwtPayload,
    @Param('idSession', ParseIntPipe) idSession: number,
    @Body() dto: AttendanceQrTokenDto,
    @Req() request: Request,
  ) {
    this.strictQrBody(request, ['token']);
    this.qrId(idSession);
    return this.attendancesService.checkInQr(user.idUser, idSession, dto);
  }

  @Permissions('attendance.qr.check-in')
  @Post('sessions/:idSession/qr-context')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @UseFilters(AttendanceQrValidationFilter)
  getQrContext(
    @CurrentUser() user: JwtPayload,
    @Param('idSession', ParseIntPipe) idSession: number,
    @Body() dto: AttendanceQrTokenDto,
    @Req() request: Request,
  ) {
    this.strictQrBody(request, ['token']);
    this.qrId(idSession);
    return this.attendancesService.getQrContext(user.idUser, idSession, dto);
  }

  @Permissions('attendance.qr.check-in')
  @Get('sessions/:idSession/qr-own-mark')
  @Header('Cache-Control', 'no-store')
  @UseFilters(AttendanceQrValidationFilter)
  getQrOwnMark(
    @CurrentUser() user: JwtPayload,
    @Param('idSession', ParseIntPipe) idSession: number,
  ) {
    this.qrId(idSession);
    return this.attendancesService.getQrOwnMark(user.idUser, idSession);
  }

  @Permissions('attendance.check-in')
  @Post('sessions/:idSession/check-in')
  @UseFilters(AttendanceCheckInValidationFilter)
  @ApiCreatedResponse({ type: AttendanceCheckInResponseDto })
  checkIn(
    @CurrentUser() user: JwtPayload,
    @Param('idSession', ParseIntPipe) idSession: number,
    @Body() dto: AttendanceCheckInDto,
    @Req() request: Request,
  ) {
    // The global pipe strips unknown keys from the DTO, so inspect the original
    // body as well to reject attempts to supply identity, state or evidence.
    const body: unknown = request.body;
    if (
      !body ||
      typeof body !== 'object' ||
      Array.isArray(body) ||
      Object.keys(body).some((key) => !['latitude', 'longitude', 'accuracy'].includes(key))
    )
      throw new AttendanceCheckInException(
        AttendanceCheckInCode.LOCATION_INVALID,
        HttpStatus.BAD_REQUEST,
      );
    return this.attendancesService.checkIn(user.idUser, idSession, dto);
  }

  @Permissions('attendance.check-in')
  @Get('student/my/:idEnrollment/sessions')
  @ApiOkResponse({
    type: StudentAttendanceSessionDto,
    isArray: true,
    description:
      'OPEN and SCHEDULED within the next 24 hours; up to 20, OPEN first. meta.hasMore indicates truncation.',
  })
  getOwnEligibleSessions(
    @CurrentUser() user: JwtPayload,
    @Param('idEnrollment', ParseIntPipe) idEnrollment: number,
  ) {
    return this.attendancesService.getOwnEligibleSessions(user.idUser, idEnrollment);
  }

  @Permissions('attendance.session.create')
  @Post('sessions')
  @ApiCreatedResponse({ type: AttendanceSessionLifecycleResponseDto })
  async createSession(@CurrentUser() user: JwtPayload, @Body() dto: AttendanceSessionCreateDto) {
    const session = await this.attendancesService.createSession(user.idUser, dto);
    return { ...session, ...attendanceSessionResponse(session, new Date()) };
  }

  @Permissions('attendance.session.get-by-enrollment')
  @Get('sessions/enrollment/:idEnrollment')
  async getSessionsByEnrollment(
    @Query() query: AttendanceHistoryQueryDto,
    @CurrentUser() user: JwtPayload,
    @Param('idEnrollment', ParseIntPipe)
    idEnrollment: number,
  ) {
    if (query.page !== undefined || query.limit !== undefined || query.date)
      return this.attendancesService.getSessionsPage(user.idUser, idEnrollment, query);
    return this.attendancesService.getSessionsByEnrollment(user.idUser, idEnrollment);
  }

  @Permissions('attendance.session.get-one')
  @Get('sessions/:idSession')
  async getSession(
    @Query() query: StudentRosterQueryDto,
    @CurrentUser() user: JwtPayload,
    @Param('idSession', ParseIntPipe)
    idSession: number,
  ) {
    if (query.page !== undefined || query.limit !== undefined || query.search !== undefined)
      return this.attendancesService.getSessionPage(user.idUser, idSession, query);
    return this.attendancesService.getSessionDetail(user.idUser, idSession);
  }

  @Permissions('attendance.session.update')
  @Patch('sessions/:idSession/geolocation')
  @ApiOkResponse({ type: AttendanceSessionLifecycleResponseDto })
  configureGeolocation(
    @CurrentUser() user: JwtPayload,
    @Param('idSession', ParseIntPipe) idSession: number,
    @Body() dto: AttendanceGeolocationConfigDto,
  ) {
    return this.attendancesService.configureGeolocation(user.idUser, idSession, dto);
  }

  @Permissions('attendance.session.update')
  @Patch('sessions/:idSession/activate')
  @ApiOkResponse({ type: AttendanceSessionLifecycleResponseDto })
  activate(@CurrentUser() user: JwtPayload, @Param('idSession', ParseIntPipe) idSession: number) {
    return this.attendancesService.activateSession(user.idUser, idSession);
  }

  @Permissions('attendance.session.update')
  @Patch('sessions/:idSession/open-now')
  @ApiOkResponse({ type: AttendanceSessionLifecycleResponseDto })
  openNow(@CurrentUser() user: JwtPayload, @Param('idSession', ParseIntPipe) idSession: number) {
    return this.attendancesService.activateSession(user.idUser, idSession, true);
  }

  @Permissions('attendance.session.update')
  @Patch('sessions/:idSession/close')
  @ApiOkResponse({ type: AttendanceSessionLifecycleResponseDto })
  close(@CurrentUser() user: JwtPayload, @Param('idSession', ParseIntPipe) idSession: number) {
    return this.attendancesService.closeSession(user.idUser, idSession);
  }

  @Permissions('attendance.session.update')
  @Patch('sessions/:idSession/cancel')
  @ApiOkResponse({ type: AttendanceSessionLifecycleResponseDto })
  cancel(@CurrentUser() user: JwtPayload, @Param('idSession', ParseIntPipe) idSession: number) {
    return this.attendancesService.cancelSession(user.idUser, idSession);
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
  @ApiOkResponse({ type: StudentAttendanceResponseDto })
  @Get('student/:idEnrollment')
  async getStudentAttendance(
    @CurrentUser() user: JwtPayload,
    @Param('idEnrollment', ParseIntPipe) idEnrollment: number,
  ) {
    return this.attendancesService.getStudentAttendance(user.idUser, idEnrollment);
  }

  @Permissions('enrollment.get-my-enrollment')
  @ApiOkResponse({ type: StudentAttendanceResponseDto })
  @Get('student/my/:idEnrollment')
  async getMyAttendance(
    @CurrentUser() user: JwtPayload,
    @Param('idEnrollment', ParseIntPipe) idEnrollment: number,
  ) {
    return this.attendancesService.getMyStudentAttendance(user.idUser, idEnrollment);
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
