import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CareersController } from 'src/controllers/careers/careers.controller';
import { Career } from 'src/entities/careers/careers.entity';
import { CareersService } from 'src/services/careers/careers.service';
import { CareerStudentImportService } from 'src/services/careers/career-student-import.service';
import { CareerStudentImportController } from 'src/controllers/careers/career-student-import.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Career])],
  providers: [CareersService, CareerStudentImportService],
  controllers: [CareersController, CareerStudentImportController],
  exports: [CareersService],
})
export class CareersModule {}
