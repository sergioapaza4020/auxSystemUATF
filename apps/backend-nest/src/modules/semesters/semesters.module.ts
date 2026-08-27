import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SemestersController } from 'src/controllers/semesters/semesters.controller';
import { Semester } from 'src/entities/semesters/semester.entity';
import { SemestersService } from 'src/services/semesters/semesters.service';

@Module({
  imports: [TypeOrmModule.forFeature([Semester])],
  providers: [SemestersService],
  controllers: [SemestersController],
  exports: [SemestersService],
})
export class SemestersModule {}
