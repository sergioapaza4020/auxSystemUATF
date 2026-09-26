import { CourseUpdateDto } from 'src/dtos/courses/courses-update.dto';
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CourseCreateDto } from 'src/dtos/courses/courses.dto';
import { Course } from 'src/entities/courses/courses.entity';
import { Repository } from 'typeorm';

@Injectable()
export class CoursesService {
  constructor(@InjectRepository(Course) private readonly courseRepository: Repository<Course>) {}

  async getAll(): Promise<Course[]> {
    return this.courseRepository.find({
      where: { isActive: true },
      relations: { userCourses: true },
      order: { code: 'ASC' },
    });
  }

  async create(courseCreateDto: CourseCreateDto, authorId: number) {
    courseCreateDto.code = courseCreateDto.code.toUpperCase().trim();
    const course = await this.courseRepository.findOne({
      where: [{ name: courseCreateDto.name }, { code: courseCreateDto.code }],
    });
    if (course) throw new BadRequestException('Course already exists');

    const courseCreated = this.courseRepository.create(courseCreateDto);
    courseCreated.createdBy = authorId;
    return this.courseRepository.save(courseCreated);
  }

  async getOneById(idCourse: number): Promise<Course | null> {
    return this.courseRepository.findOne({
      where: { idCourse, isActive: true },
    });
  }

  async getOneByName(name: string): Promise<Course | null> {
    return this.courseRepository.findOne({
      where: { name, isActive: true },
    });
  }

  async getOneByCode(code: string): Promise<Course | null> {
    return this.courseRepository.findOne({
      where: { code, isActive: true },
    });
  }

  async delete(idCourse: number) {
    const course = await this.courseRepository.findOne({
      where: { idCourse, isActive: true },
    });
    if (!course) throw new BadRequestException('Course not found');
    course.isActive = false;
    return this.courseRepository.save(course);
  }

  async reactivate(idCourse: number) {
    const course = await this.courseRepository.findOne({
      where: { idCourse, isActive: false },
    });
    if (!course) throw new BadRequestException('Course not found');
    course.isActive = true;
    return this.courseRepository.save(course);
  }

  async update(idCourse: number, dto: CourseUpdateDto) {
    const record = await this.courseRepository.findOne({ where: { idCourse, isActive: true } });
    if (!record) throw new BadRequestException('Course not found');
    const name = dto.name;
    if (name !== undefined) {
      const duplicate = await this.courseRepository.findOne({ where: { name } });
      if (duplicate && duplicate.idCourse !== idCourse)
        throw new BadRequestException('Course already exists');
    }

    if (dto.code !== undefined) {
      const duplicate = await this.courseRepository.findOne({
        where: { code: dto.code.toUpperCase().trim() },
      });
      if (duplicate && duplicate.idCourse !== idCourse)
        throw new BadRequestException('Course code already exists');
      dto.code = dto.code.toUpperCase().trim();
    }

    this.courseRepository.merge(record, dto, name === undefined ? {} : { name });
    return this.courseRepository.save(record);
  }
}
