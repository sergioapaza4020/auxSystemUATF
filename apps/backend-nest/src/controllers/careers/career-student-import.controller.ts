import {
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '@core/decorators/current-user/current-user.decorator';
import { Permissions } from '@core/decorators/permissions/permissions.decorator';
import type { JwtPayload } from '@common/types/jwt-payload.type';
import { studentRuImportUploadOptions } from '@common/imports/student-ru-import';
import { CareerStudentImportParamsDto } from 'src/dtos/careers/career-student-import.dto';
import { CareerStudentImportService } from 'src/services/careers/career-student-import.service';

const importBody = {
  schema: {
    type: 'object',
    required: ['file'],
    properties: { file: { type: 'string', format: 'binary' } },
  },
};

@ApiBearerAuth('access-token')
@ApiTags('Careers')
@Controller('careers/:careerId/students/import')
export class CareerStudentImportController {
  constructor(private readonly service: CareerStudentImportService) {}

  @Get('template')
  @Permissions('career.update')
  async template(@Param() params: CareerStudentImportParamsDto, @Res() response: Response) {
    const buffer = await this.service.template(params.careerId);
    response.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="plantilla-estudiantes-carrera-${params.careerId}.xlsx"`,
    );
    response.send(buffer);
  }

  @Post('preview')
  @HttpCode(200)
  @Permissions('career.update')
  @ApiConsumes('multipart/form-data')
  @ApiBody(importBody)
  @UseInterceptors(FileInterceptor('file', studentRuImportUploadOptions))
  preview(
    @Param() params: CareerStudentImportParamsDto,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    return this.service.preview(file, params.careerId);
  }

  @Post()
  @Permissions('career.update')
  @ApiConsumes('multipart/form-data')
  @ApiBody(importBody)
  @UseInterceptors(FileInterceptor('file', studentRuImportUploadOptions))
  import(
    @Param() params: CareerStudentImportParamsDto,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.service.import(file, params.careerId, actor.idUser);
  }
}
