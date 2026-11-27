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
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type { JwtPayload } from '@common/types/jwt-payload.type';
import { studentRuImportUploadOptions } from '@common/imports/student-ru-import';
import { CurrentUser } from '@core/decorators/current-user/current-user.decorator';
import { Permissions } from '@core/decorators/permissions/permissions.decorator';
import { GradeImportPreviewDto } from 'src/dtos/grades/grade-import.dto';
import { GradeImportService } from 'src/services/grades/grade-import.service';

@ApiBearerAuth('access-token')
@ApiTags('Grades')
@Controller('grades/import/:enrollmentId')
export class GradeImportController {
  constructor(private readonly service: GradeImportService) {}

  @Permissions('grade.create')
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
    response.setHeader(
      'Content-Disposition',
      'attachment; filename="plantilla-calificaciones.xlsx"',
    );
    response.setHeader('Cache-Control', 'no-store');
    response.send(file);
  }

  @Permissions('grade.create')
  @Post('preview')
  @HttpCode(200)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
        options: { type: 'string', example: '{"choices":[],"updateExisting":false}' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file', studentRuImportUploadOptions))
  preview(
    @CurrentUser() user: JwtPayload,
    @Param('enrollmentId', ParseIntPipe) enrollmentId: number,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: GradeImportPreviewDto,
  ) {
    return this.service.preview(user, enrollmentId, file, GradeImportPreviewDto.parse(dto.options));
  }

  @Permissions('grade.create')
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
