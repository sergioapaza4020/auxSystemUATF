import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GradeItemsController } from 'src/controllers/grade-items/grade-items.controller';
import { GradeItem } from 'src/entities/grade-items/grade-items.entity';
import { GradeItemsService } from 'src/services/grade-items/grade-items.service';

@Module({
  imports: [TypeOrmModule.forFeature([GradeItem])],
  providers: [GradeItemsService],
  controllers: [GradeItemsController],
  exports: [GradeItemsService],
})
export class GradeItemsModule {}
