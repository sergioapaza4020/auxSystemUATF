import { Permissions } from '@core/decorators/permissions/permissions.decorator';
import { Body, Controller, Get, Post } from '@nestjs/common';
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
}
