import type { JwtPayload } from '@common/types/jwt-payload.type';
import { CurrentUser } from '@core/decorators/current-user/current-user.decorator';
import { Permissions } from '@core/decorators/permissions/permissions.decorator';
import { Body, Controller, Get, Param, ParseIntPipe, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  AssistantGradeSchemeCreateDto,
  AssistantGradeSchemeUpdateDto,
} from 'src/dtos/assistant-grade-schemes/assistant-grade-scheme.dto';
import { AssistantGradeSchemesService } from 'src/services/grade-schemes/assistant-grade-schemes.service';

@ApiBearerAuth('access-token')
@Controller('assistant-grade-schemes')
@ApiTags('Assistant grade schemes')
export class AssistantGradeSchemesController {
  constructor(private readonly assistantGradeSchemesService: AssistantGradeSchemesService) {}

  @Permissions('assistant-grade-scheme.get-one')
  @Get('course/:idCourse')
  async getMyScheme(
    @CurrentUser() user: JwtPayload,
    @Param('idCourse', ParseIntPipe) idCourse: number,
  ) {
    return this.assistantGradeSchemesService.getMyScheme(user.idUser, idCourse);
  }

  @Permissions('assistant-grade-scheme.create')
  @Post('course/:idCourse')
  async create(
    @CurrentUser() user: JwtPayload,
    @Param('idCourse', ParseIntPipe) idCourse: number,
    @Body() dto: AssistantGradeSchemeCreateDto,
  ) {
    return this.assistantGradeSchemesService.create(user.idUser, idCourse, dto);
  }

  @Permissions('assistant-grade-scheme.update')
  @Put(':idAssistantGradeScheme')
  async update(
    @CurrentUser() user: JwtPayload,
    @Param('idAssistantGradeScheme', ParseIntPipe)
    idAssistantGradeScheme: number,
    @Body() dto: AssistantGradeSchemeUpdateDto,
  ) {
    return this.assistantGradeSchemesService.update(user.idUser, idAssistantGradeScheme, dto);
  }
}
