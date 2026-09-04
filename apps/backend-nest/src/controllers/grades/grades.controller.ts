import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CreateGradeDto } from 'src/dtos/grades/create-grade.dto';
import { UpdateGradeDto } from 'src/dtos/grades/update-grade.dto';
import { GradesService } from 'src/services/grades/grades.service';

@ApiBearerAuth('access-token')
@Controller('grades')
@ApiTags('Grades')
export class GradesController {
  constructor(private readonly gradesService: GradesService) {}

  @Post()
  async create(@Body() dto: CreateGradeDto) {
    return this.gradesService.create(dto);
  }

  @Get('enrollment/:idEnrollment')
  async getByEnrollment(
    @Param('idEnrollment', ParseIntPipe)
    idEnrollment: number,
  ) {
    return this.gradesService.getByEnrollment(idEnrollment);
  }

  @Get(':idGrade')
  async getOne(
    @Param('idGrade', ParseIntPipe)
    idGrade: number,
  ) {
    return this.gradesService.getOne(idGrade);
  }

  @Patch(':idGrade')
  async update(
    @Param('idGrade', ParseIntPipe)
    idGrade: number,
    @Body() dto: UpdateGradeDto,
  ) {
    return this.gradesService.update(idGrade, dto);
  }

  @Delete(':idGrade')
  async remove(
    @Param('idGrade', ParseIntPipe)
    idGrade: number,
  ) {
    return this.gradesService.remove(idGrade);
  }
}
