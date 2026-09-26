import { CareerUpdateDto } from 'src/dtos/careers/careers-update.dto';
import { Faculty } from 'src/entities/faculties/faculties.entity';
import { User } from 'src/entities/users/users.entity';
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CareerCreateDto } from 'src/dtos/careers/careers.dto';
import { Career } from 'src/entities/careers/careers.entity';
import { In, Repository } from 'typeorm';

@Injectable()
export class CareersService {
  constructor(@InjectRepository(Career) private readonly careerRepository: Repository<Career>) {}

  async getAll(): Promise<Career[]> {
    return this.careerRepository.find({
      where: { isActive: true },
    });
  }

  async create(careerCreateDto: CareerCreateDto, authorId: number): Promise<Career> {
    const career = await this.careerRepository.findOne({ where: { name: careerCreateDto.name } });
    if (career) throw new BadRequestException('Career already exists');

    const careerCreated = this.careerRepository.create(await this.resolveData(careerCreateDto));
    careerCreated.createdBy = authorId;
    return this.careerRepository.save(careerCreated);
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

  async delete(idCareer: number) {
    const career = await this.careerRepository.findOne({
      where: { idCareer, isActive: true },
    });
    if (!career) throw new BadRequestException('Career not found');
    career.isActive = false;
    return this.careerRepository.save(career);
  }

  async reactivate(idCareer: number) {
    const career = await this.careerRepository.findOne({
      where: { idCareer, isActive: false },
    });
    if (!career) throw new BadRequestException('Career not found');
    career.isActive = true;
    return this.careerRepository.save(career);
  }

  private async resolveData(dto: CareerUpdateDto) {
    const data: Partial<Career> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.idFaculty !== undefined) {
      const faculty = await this.careerRepository.manager
        .getRepository(Faculty)
        .findOne({ where: { idFaculty: dto.idFaculty, isActive: true } });
      if (!faculty) throw new BadRequestException('Faculty not found');
      data.faculty = faculty;
    }
    if (dto.idDirector !== undefined) {
      const director = await this.careerRepository.manager
        .getRepository(User)
        .findOne({ where: { idUser: dto.idDirector, isActive: true } });
      if (!director) throw new BadRequestException('Director not found');
      data.director = director;
    }
    if (dto.idMembers !== undefined) {
      const members = await this.careerRepository.manager
        .getRepository(User)
        .find({ where: { idUser: In(dto.idMembers), isActive: true } });
      if (members.length !== new Set(dto.idMembers).size)
        throw new BadRequestException('Career member not found');
      data.members = members;
    }
    return data;
  }

  async update(idCareer: number, dto: CareerUpdateDto) {
    const career = await this.getOneById(idCareer);
    if (!career) throw new BadRequestException('Career not found');
    if (dto.name !== undefined) {
      const duplicate = await this.careerRepository.findOne({ where: { name: dto.name } });
      if (duplicate && duplicate.idCareer !== idCareer)
        throw new BadRequestException('Career already exists');
    }
    this.careerRepository.merge(career, await this.resolveData(dto));
    return this.careerRepository.save(career);
  }
}
