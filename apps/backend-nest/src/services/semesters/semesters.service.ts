import { RecordStatus } from 'src/dtos/common/status-query.dto';
import { statusFilter } from '@common/utils/status-filter';
import { SemesterUpdateDto } from 'src/dtos/semesters/semesters-update.dto';
import { SemesterNumber } from '@common/enums/semesterNumber';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { SemesterCreateDto } from 'src/dtos/semesters/semesters.dto';
import { Semester } from 'src/entities/semesters/semester.entity';
import { Repository } from 'typeorm';

@Injectable()
export class SemestersService {
  constructor(
    @InjectRepository(Semester) private readonly semesterRepository: Repository<Semester>,
  ) {}

  async getAll(status: RecordStatus = RecordStatus.ACTIVE): Promise<Semester[]> {
    return this.semesterRepository.find({
      where: statusFilter(status),
    });
  }

  async create(semesterCreateDto: SemesterCreateDto): Promise<Semester> {
    const semester = await this.semesterRepository.findOne({
      where: { period: semesterCreateDto.period, year: semesterCreateDto.year },
    });

    if (semester) throw new ConflictException('Semestre ya registrado');

    this.validateDates(semesterCreateDto.startDate, semesterCreateDto.endDate);
    const semesterCreated = this.semesterRepository.create(semesterCreateDto);
    semesterCreated.createdBy = 0;

    return this.semesterRepository.save(semesterCreated);
  }

  async getCurrentSemester(): Promise<Semester> {
    const now = new Date();

    const semester = await this.semesterRepository
      .createQueryBuilder('semester')
      .where('semester.start_date <= :now', { now })
      .andWhere('semester.end_date >= :now', { now })
      .andWhere('semester.is_active = true')
      .getOne();

    if (!semester) {
      throw new NotFoundException('No existe un semestre activo para la fecha actual');
    }

    return semester;
  }

  async getOneById(idSemester: number) {
    return this.semesterRepository.findOne({
      where: { idSemester, isActive: true },
    });
  }

  async getOneByPeriodYear(period: SemesterNumber, year: number) {
    return this.semesterRepository.findOne({
      where: { period, year, isActive: true },
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

  private validateDates(startDate: Date, endDate: Date) {
    if (new Date(startDate).getTime() > new Date(endDate).getTime()) {
      throw new BadRequestException('La fecha de inicio no puede ser posterior a la fecha de fin');
    }
  }

  async update(idSemester: number, dto: SemesterUpdateDto) {
    const semester = await this.getOneById(idSemester);
    if (!semester) throw new NotFoundException('Semester not found');
    this.semesterRepository.merge(semester, dto);
    this.validateDates(semester.startDate, semester.endDate);
    const duplicate = await this.semesterRepository.findOne({
      where: { period: semester.period, year: semester.year },
    });
    if (duplicate && duplicate.idSemester !== idSemester)
      throw new ConflictException('Semestre ya registrado');
    return this.semesterRepository.save(semester);
  }
}
