import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { GradeSchemeCreateDto } from 'src/dtos/grade-schemes/grade-schemes.dto';
import { GradeScheme } from 'src/entities/grade-schemes/grade-schemes.entity';
import { Repository } from 'typeorm';

@Injectable()
export class GradeSchemesService {
  constructor(
    @InjectRepository(GradeScheme) private readonly gradeSchemeRepository: Repository<GradeScheme>,
  ) {}

  async getAll(): Promise<GradeScheme[]> {
    return this.gradeSchemeRepository.find({
      where: { isActive: true },
      relations: { details: true },
    });
  }

  async create(gradeSchemeCreateDto: GradeSchemeCreateDto, authorId: number) {
    const gradeScheme = await this.getOneByName(gradeSchemeCreateDto.name);
    if (!gradeScheme) throw new BadRequestException('GradeScheme does not exists');

    const gradeSchemeCreated = this.gradeSchemeRepository.create();
    gradeSchemeCreated.createdBy = authorId;
    return gradeSchemeCreated;
  }

  async getOneById(idGradeScheme: number): Promise<GradeScheme | null> {
    return this.gradeSchemeRepository.findOne({
      where: { idGradeScheme, isActive: true },
    });
  }

  async getOneByName(name: string): Promise<GradeScheme | null> {
    return this.gradeSchemeRepository.findOne({
      where: { name, isActive: true },
    });
  }

  async delete(idGradeScheme: number) {
    const gradeScheme = await this.gradeSchemeRepository.findOne({
      where: { idGradeScheme, isActive: true },
    });
    if (!gradeScheme) throw new BadRequestException('GradeScheme not found');
    gradeScheme.isActive = false;
    return this.gradeSchemeRepository.save(gradeScheme);
  }

  async reactivate(idGradeScheme: number) {
    const gradeScheme = await this.gradeSchemeRepository.findOne({
      where: { idGradeScheme, isActive: false },
    });
    if (!gradeScheme) throw new BadRequestException('GradeScheme not found');
    gradeScheme.isActive = true;
    return this.gradeSchemeRepository.save(gradeScheme);
  }
}
