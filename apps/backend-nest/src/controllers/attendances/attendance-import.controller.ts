import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type { JwtPayload } from '@common/types/jwt-payload.type';
import { studentRuImportUploadOptions } from '@common/imports/student-ru-import';
import { CurrentUser } from '@core/decorators/current-user/current-user.decorator';
import { Permissions } from '@core/decorators/permissions/permissions.decorator';
import { AttendanceImportDto } from 'src/dtos/attendances/attendance-import.dto';
import { AttendanceImportService } from 'src/services/attendances/attendance-import.service';

@ApiBearerAuth('access-token')
@ApiTags('Attendances')
@Controller('attendances/import/:enrollmentId')
export class AttendanceImportController {
  constructor(private readonly service: AttendanceImportService) {}

  @Permissions('attendance.save')
  @Get('template')
  async template(
    @CurrentUser() user: JwtPayload,
    @Param('enrollmentId', ParseIntPipe) enrollmentId: number,
    @Res() response: Response,
  ) {
    const file = await this.service.template(user, enrollmentId);
    response.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    response.setHeader('Content-Disposition', 'attachment; filename="plantilla-asistencia.xlsx"');
    response.setHeader('Cache-Control', 'no-store');
    response.send(file);
  }

  @Permissions('attendance.save')
  @Post('preview')
  @HttpCode(200)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', studentRuImportUploadOptions))
  preview(
    @CurrentUser() user: JwtPayload,
    @Param('enrollmentId', ParseIntPipe) enrollmentId: number,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: AttendanceImportDto,
  ) {
    return this.service.preview(user, enrollmentId, file, AttendanceImportDto.parse(dto.options));
  }

  @Permissions('attendance.save')
  @Post(':operationId/confirm')
  @HttpCode(200)
  confirm(
    @CurrentUser() user: JwtPayload,
    @Param('enrollmentId', ParseIntPipe) enrollmentId: number,
    @Param('operationId', ParseUUIDPipe) operationId: string,
  ) {
    return this.service.confirm(user, enrollmentId, operationId);
  }
}
