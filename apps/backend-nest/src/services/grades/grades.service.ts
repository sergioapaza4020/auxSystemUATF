import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { CreateGradeDto } from 'src/dtos/grades/create-grade.dto';
import { UpdateGradeDto } from 'src/dtos/grades/update-grade.dto';
import { Enrollment } from 'src/entities/enrollments/enrollments.entity';
import { GradeSchemeDetail } from 'src/entities/grade-scheme-detail/grade-scheme-detail.entity';
import { Grade } from 'src/entities/grades/grades.entity';
import { Repository } from 'typeorm';

@Injectable()
export class GradesService {
  constructor(
    @InjectRepository(Grade)
    private readonly gradeRepository: Repository<Grade>,
    @InjectRepository(Enrollment)
    private readonly enrollmentRepository: Repository<Enrollment>,
    @InjectRepository(GradeSchemeDetail)
    private readonly gradeSchemeDetailRepository: Repository<GradeSchemeDetail>,
  ) {}

  async create(dto: CreateGradeDto) {
    const enrollment = await this.enrollmentRepository.findOne({
      where: {
        idEnrollment: dto.enrollmentId,
      },
      relations: {
        course: {
          gradeScheme: true,
        },
      },
    });

    if (!enrollment) {
      throw new NotFoundException('Matriculación no encontrada');
    }

    const detail = await this.gradeSchemeDetailRepository.findOne({
      where: {
        idGradeSchemeDetail: dto.gradeSchemeDetailId,
      },
      relations: {
        gradeScheme: true,
        gradeItem: true,
      },
    });

    if (!detail) {
      throw new NotFoundException('Detalle del esquema de notas no encontrado');
    }

    if (enrollment.course.gradeScheme?.idGradeScheme !== detail.gradeScheme.idGradeScheme) {
      throw new BadRequestException('El componente de nota no pertenece al esquema de la materia');
    }

    const existing = await this.gradeRepository.findOne({
      where: {
        enrollment: {
          idEnrollment: enrollment.idEnrollment,
        },
        gradeSchemeDetail: {
          idGradeSchemeDetail: detail.idGradeSchemeDetail,
        },
      },
    });

    if (existing) {
      throw new ConflictException('Ya existe una nota para este componente');
    }

    const grade = this.gradeRepository.create({
      enrollment,
      gradeSchemeDetail: detail,
      score: dto.score,
    });

    return this.gradeRepository.save(grade);
  }

  async getByEnrollment(idEnrollment: number) {
    const enrollment = await this.enrollmentRepository.findOne({
      where: {
        idEnrollment,
      },
    });

    if (!enrollment) {
      throw new NotFoundException('Matriculación no encontrada');
    }

    return this.gradeRepository.find({
      where: {
        enrollment: {
          idEnrollment,
        },
      },
      relations: {
        gradeSchemeDetail: {
          gradeItem: true,
          gradeScheme: true,
        },
      },
      order: {
        gradeSchemeDetail: {
          order: 'ASC',
        },
      },
    });
  }

  async getOne(idGrade: number) {
    const grade = await this.gradeRepository.findOne({
      where: {
        idGrade,
      },
      relations: {
        enrollment: true,
        gradeSchemeDetail: {
          gradeItem: true,
          gradeScheme: true,
        },
      },
    });

    if (!grade) {
      throw new NotFoundException('Nota no encontrada');
    }

    return grade;
  }

  async update(idGrade: number, dto: UpdateGradeDto) {
    const grade = await this.getOne(idGrade);

    if (dto.score !== undefined) {
      grade.score = dto.score;
    }

    return this.gradeRepository.save(grade);
  }

  async remove(idGrade: number) {
    const grade = await this.getOne(idGrade);

    await this.gradeRepository.remove(grade);

    return {
      message: 'Nota eliminada correctamente',
    };
  }
}
