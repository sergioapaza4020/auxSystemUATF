import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FacultyCreateDto } from 'src/dtos/faculties/faculties.dto';
import { Faculty } from 'src/entities/faculties/faculties.entity';
import { Repository } from 'typeorm';

@Injectable()
export class FacultiesService {
  constructor(@InjectRepository(Faculty) private readonly facultyRepository: Repository<Faculty>) {}

  async getAll(): Promise<Faculty[]> {
    return this.facultyRepository.find({
      where: { isActive: true },
      relations: { careers: true },
    });
  }

  async create(facultyCreateDto: FacultyCreateDto, authorId: number) {
    const faculty = await this.getOneByName(facultyCreateDto.name);
    if (!faculty) throw new BadRequestException('Faculty does not exists');

    const facultyCreated = this.facultyRepository.create();
    facultyCreated.createdBy = authorId;
    return facultyCreated;
  }

  async getOneById(idFaculty: number): Promise<Faculty | null> {
    return this.facultyRepository.findOne({
      where: { idFaculty, isActive: true },
    });
  }

  async getOneByName(name: string): Promise<Faculty | null> {
    return this.facultyRepository.findOne({
      where: { name, isActive: true },
    });
  }

  async delete(idFaculty: number) {
    const faculty = await this.facultyRepository.findOne({
      where: { idFaculty, isActive: true },
    });
    if (!faculty) throw new BadRequestException('Faculty not found');
    faculty.isActive = false;
    return this.facultyRepository.save(faculty);
  }

  async reactivate(idFaculty: number) {
    const faculty = await this.facultyRepository.findOne({
      where: { idFaculty, isActive: false },
    });
    if (!faculty) throw new BadRequestException('Faculty not found');
    faculty.isActive = true;
    return this.facultyRepository.save(faculty);
  }
}
