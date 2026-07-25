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
    });
  }

  async create(courseCreateDto: CourseCreateDto, authorId: number) {
    const course = await this.getOneByName(courseCreateDto.name);
    if (course) throw new BadRequestException('Course already exists');

    const courseCreated = this.courseRepository.create();
    courseCreated.createdBy = authorId;
    return courseCreated;
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
}
