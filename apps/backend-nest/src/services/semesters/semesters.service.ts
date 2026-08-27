import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { SemesterCreateDto } from 'src/dtos/semesters/semesters.dto';
import { Semester } from 'src/entities/semesters/semester.entity';
import { Repository } from 'typeorm';

@Injectable()
export class SemestersService {
  constructor(
    @InjectRepository(Semester) private readonly semesterRepository: Repository<Semester>,
  ) {}

  async getAll(): Promise<Semester[]> {
    return this.semesterRepository.find({
      where: { isActive: true },
    });
  }

  async create(semesterCreateDto: SemesterCreateDto): Promise<Semester> {
    const semester = await this.semesterRepository.findOne({
      where: { period: semesterCreateDto.period, year: semesterCreateDto.year },
    });

    if (semester) throw new ConflictException('Semestre ya registrado');

    const semesterCreated = this.semesterRepository.create(semesterCreateDto);
    semesterCreated.createdBy = 0;

    return this.semesterRepository.save(semesterCreated);
  }

  async getOneById(idSemester: number) {
    return this.semesterRepository.findOne({
      where: { idSemester, isActive: true },
    });
  }

  async delete(idSemester: number) {
    const semester = await this.semesterRepository.findOne({
      where: { idSemester, isActive: true },
    });
    if (!semester) throw new BadRequestException('Semester not found');
    semester.isActive = false;

    return this.semesterRepository.save(semester);
  }

  async reactivate(idSemester: number) {
    const semester = await this.semesterRepository.findOne({
      where: { idSemester, isActive: false },
    });
    if (!semester) throw new BadRequestException('Semester not found');
    semester.isActive = true;

    return this.semesterRepository.save(semester);
  }
}
