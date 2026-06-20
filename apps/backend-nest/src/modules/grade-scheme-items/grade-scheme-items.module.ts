import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GradeSchemeItemsController } from 'src/controllers/grade-scheme-items/grade-scheme-items.controller';
import { GradeSchemeItem } from 'src/entities/grade-scheme-items/grade-scheme-items.entity';
import { GradeSchemeItemsService } from 'src/services/grade-scheme-items/grade-scheme-items.service';

@Module({
  imports: [TypeOrmModule.forFeature([GradeSchemeItem])],
  providers: [GradeSchemeItemsService],
  controllers: [GradeSchemeItemsController],
  exports: [GradeSchemeItemsService],
})
export class GradeSchemeItemsModule {}
