import { EnrollmentUpdateDto } from 'src/dtos/enrollments/enrollments-update.dto';
import type { JwtPayload } from '@common/types/jwt-payload.type';
import { CurrentUser } from '@core/decorators/current-user/current-user.decorator';
import { Permissions } from '@core/decorators/permissions/permissions.decorator';
import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { EnrollmentCreateDto } from 'src/dtos/enrollments/enrollments.dto';
import { EnrollmentsService } from 'src/services/enrollments/enrollments.service';

@ApiBearerAuth('access-token')
@Controller('enrollments')
@ApiTags('Enrollments')
export class EnrollmentsController {
  constructor(private readonly enrollmentsService: EnrollmentsService) {}

  @Permissions('enrollment.get-all')
  @Get()
  async getAll() {
    return this.enrollmentsService.getAll();
  }

  @Permissions('enrollment.create')
  @Post()
  async create(@Body() dto: EnrollmentCreateDto) {
    return this.enrollmentsService.create(dto);
  }

  @Permissions('enrollment.get-my-enrollments')
  @Get('my-enrollments')
  async getMyEnrollments(@CurrentUser() user: JwtPayload) {
    return this.enrollmentsService.getUserEnrollments(user.idUser);
  }

  @Permissions('enrollment.get-my-enrollment')
  @Get('my-enrollments/:idEnrollment')
  async getMyEnrollment(
    @CurrentUser() user: JwtPayload,
    @Param('idEnrollment', ParseIntPipe) idEnrollment: number,
  ) {
    return this.enrollmentsService.getMyEnrollment(user.idUser, idEnrollment);
  }

  @Permissions('enrollment.get-managed-enrollment')
  @Get('managed/:idEnrollment')
  async getManagedEnrollment(
    @CurrentUser() user: JwtPayload,
    @Param('idEnrollment', ParseIntPipe) idEnrollment: number,
  ) {
    return this.enrollmentsService.getManagedEnrollment(user.idUser, idEnrollment);
  }

  @Permissions('enrollment.get-students-by-enrollment')
  @Get(':idEnrollment/students')
  async getStudentsByEnrollment(
    @CurrentUser() user: JwtPayload,
    @Param('idEnrollment', ParseIntPipe)
    idEnrollment: number,
  ) {
    return this.enrollmentsService.getStudentsByEnrollment(user.idUser, idEnrollment);
  }

  @Permissions('enrollment.get-one-by-id')
  @Get('id/:idEnrollment')
  async getOneById(@Param('idEnrollment', ParseIntPipe) idEnrollment: number) {
    return this.enrollmentsService.getOneById(idEnrollment);
  }

  @Permissions('enrollment.update')
  @Patch(':idEnrollment')
  async update(
    @Param('idEnrollment', ParseIntPipe) idEnrollment: number,
    @Body() dto: EnrollmentUpdateDto,
  ) {
    return this.enrollmentsService.update(idEnrollment, dto);
  }

  @Permissions('enrollment.delete')
  @Delete(':idEnrollment')
  async delete(@Param('idEnrollment', ParseIntPipe) idEnrollment: number) {
    return this.enrollmentsService.delete(idEnrollment);
  }

  @Permissions('enrollment.reactivate')
  @Patch('reactivate/:idEnrollment')
  async reactivate(@Param('idEnrollment', ParseIntPipe) idEnrollment: number) {
    return this.enrollmentsService.reactivate(idEnrollment);
  }
}
