import {
  ExecuteImportDto,
  ImportPreviewQueryDto,
} from 'src/dtos/bulk-operations/import-preview.dto';
import {
  Body,
  Query,
  ParseUUIDPipe,
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
  async preview(
    @Param() params: CareerStudentImportParamsDto,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() actor: JwtPayload,
  ) {
    return { data: await this.service.preview(file, params.careerId, actor.idUser) };
  }

  @Get('preview/:operationId')
  @Permissions('career.update')
  async getPreview(
    @Param() params: CareerStudentImportParamsDto,
    @Param('operationId', ParseUUIDPipe) operationId: string,
    @Query() query: ImportPreviewQueryDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return {
      data: await this.service.getPreview(operationId, params.careerId, actor.idUser, query),
    };
  }

  @Get(':operationId/status')
  @Permissions('career.update')
  status(
    @Param() params: CareerStudentImportParamsDto,
    @Param('operationId', ParseUUIDPipe) operationId: string,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.service.status(operationId, params.careerId, actor.idUser);
  }

  @Post()
  @Permissions('career.update')
  @ApiBody({ type: ExecuteImportDto })
  import(
    @Param() params: CareerStudentImportParamsDto,
    @Body() dto: ExecuteImportDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.service.import(dto.operationId, params.careerId, actor.idUser);
  }
}
