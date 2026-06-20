import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CareersController } from 'src/controllers/careers/careers.controller';
import { Career } from 'src/entities/careers/careers.entity';
import { CareersService } from 'src/services/careers/careers.service';

@Module({
  imports: [TypeOrmModule.forFeature([Career])],
  providers: [CareersService],
  controllers: [CareersController],
  exports: [CareersService],
})
export class CareersModule {}
