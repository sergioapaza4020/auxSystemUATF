import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GradeSchemesController } from 'src/controllers/grade-schemes/grade-schemes.controller';
import { GradeScheme } from 'src/entities/grade-schemes/grade-schemes.entity';
import { GradeSchemesService } from 'src/services/grade-schemes/grade-schemes.service';

@Module({
  imports: [TypeOrmModule.forFeature([GradeScheme])],
  providers: [GradeSchemesService],
  controllers: [GradeSchemesController],
  exports: [GradeSchemesService],
})
export class GradeSchemesModule {}
