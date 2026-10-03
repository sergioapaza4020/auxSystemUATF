import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Permissions } from '@core/decorators/permissions/permissions.decorator';
import { CurrentUser } from '@core/decorators/current-user/current-user.decorator';
import type { JwtPayload } from '@common/types/jwt-payload.type';
import { EnrollmentImportTargetDto } from 'src/dtos/enrollments/enrollment-import.dto';
import { EnrollmentImportService } from 'src/services/enrollments/enrollment-import.service';
import { enrollmentImportUploadOptions } from 'src/services/enrollments/enrollment-import-excel';

const importBody = {
  schema: {
    type: 'object',
    required: ['file', 'courseId', 'semesterId'],
    properties: {
      file: { type: 'string', format: 'binary' },
      courseId: { type: 'integer', minimum: 1 },
      semesterId: { type: 'integer', minimum: 1 },
    },
  },
};

@ApiBearerAuth('access-token')
@ApiTags('Enrollments')
@Controller('enrollments/import')
export class EnrollmentImportController {
  constructor(private readonly service: EnrollmentImportService) {}

  @Get('template')
  @Permissions('enrollment.create')
  async template(
    @Query() target: EnrollmentImportTargetDto,
    @CurrentUser() actor: JwtPayload,
    @Res() response: Response,
  ) {
    const buffer = await this.service.template(target, actor);
    response.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    response.setHeader('Content-Disposition', 'attachment; filename="plantilla-matriculas.xlsx"');
    response.send(buffer);
  }

  @Post('preview')
  @HttpCode(200)
  @Permissions('enrollment.create')
  @ApiConsumes('multipart/form-data')
  @ApiBody(importBody)
  @UseInterceptors(FileInterceptor('file', enrollmentImportUploadOptions))
  preview(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() target: EnrollmentImportTargetDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.service.preview(file, target, actor);
  }

  @Post()
  @Permissions('enrollment.create')
  @ApiConsumes('multipart/form-data')
  @ApiBody(importBody)
  @UseInterceptors(FileInterceptor('file', enrollmentImportUploadOptions))
  import(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() target: EnrollmentImportTargetDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.service.import(file, target, actor);
  }
}
