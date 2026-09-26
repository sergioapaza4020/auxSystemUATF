import type { JwtPayload } from '@common/types/jwt-payload.type';
import { Query } from '@nestjs/common';
import { AssistantSchemeQueryDto } from 'src/dtos/assistant-grade-schemes/assistant-scheme-query.dto';
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
  Put,
} from '@nestjs/common';
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
    @Query() query: AssistantSchemeQueryDto,
    @CurrentUser() user: JwtPayload,
    @Param('idCourse', ParseIntPipe) idCourse: number,
  ) {
    return this.assistantGradeSchemesService.getMyScheme(
      user.idUser,
      idCourse,
      query.enrollmentId,
      query.status,
    );
  }

  @Permissions('assistant-grade-scheme.create')
  @Post('course/:idCourse')
  async create(
    @Query() query: AssistantSchemeQueryDto,
    @CurrentUser() user: JwtPayload,
    @Param('idCourse', ParseIntPipe) idCourse: number,
    @Body() dto: AssistantGradeSchemeCreateDto,
  ) {
    return this.assistantGradeSchemesService.create(user.idUser, idCourse, dto, query.enrollmentId);
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

  @Permissions('assistant-grade-scheme.delete')
  @Delete(':idAssistantGradeScheme')
  async delete(
    @CurrentUser() user: JwtPayload,
    @Param('idAssistantGradeScheme', ParseIntPipe) id: number,
  ) {
    return this.assistantGradeSchemesService.delete(user.idUser, id);
  }

  @Permissions('assistant-grade-scheme.reactivate')
  @Patch('reactivate/:idAssistantGradeScheme')
  async reactivate(
    @CurrentUser() user: JwtPayload,
    @Param('idAssistantGradeScheme', ParseIntPipe) id: number,
  ) {
    return this.assistantGradeSchemesService.reactivate(user.idUser, id);
  }
}
