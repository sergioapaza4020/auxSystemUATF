import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FacultiesController } from 'src/controllers/faculties/faculties.controller';
import { Faculty } from 'src/entities/faculties/faculties.entity';
import { FacultiesService } from 'src/services/faculties/faculties.service';

@Module({
  imports: [TypeOrmModule.forFeature([Faculty])],
  providers: [FacultiesService],
  controllers: [FacultiesController],
  exports: [FacultiesService],
})
export class FacultiesModule {}
