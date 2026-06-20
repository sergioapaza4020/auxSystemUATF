import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CareerCreateDto } from 'src/dtos/careers/careers.dto';
import { Career } from 'src/entities/careers/careers.entity';
import { Repository } from 'typeorm';

@Injectable()
export class CareersService {
  constructor(@InjectRepository(Career) private readonly careerRepository: Repository<Career>) {}

  async getAll(): Promise<Career[]> {
    return this.careerRepository.find({
      where: { isActive: true },
      relations: { faculty: true },
    });
  }

  async create(careerCreateDto: CareerCreateDto) {
    const career = await this.getOneByName(careerCreateDto.name);
    if (!career) throw new BadRequestException('Career does not exists');

    const careerCreated = this.careerRepository.create();
    return careerCreated;
  }

  async getOneById(idCareer: number): Promise<Career | null> {
    return this.careerRepository.findOne({
      where: { idCareer, isActive: true },
    });
  }

  async getOneByName(name: string): Promise<Career | null> {
    return this.careerRepository.findOne({
      where: { name, isActive: true },
    });
  }
}
