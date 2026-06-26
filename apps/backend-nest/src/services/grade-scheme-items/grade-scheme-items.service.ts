import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { GradeSchemeItemCreateDto } from 'src/dtos/grade-scheme-items/grade-scheme-items.dto';
import { GradeSchemeItem } from 'src/entities/grade-scheme-items/grade-scheme-items.entity';
import { Repository } from 'typeorm';

@Injectable()
export class GradeSchemeItemsService {
  constructor(
    @InjectRepository(GradeSchemeItem)
    private readonly gradeSchemeItemRepository: Repository<GradeSchemeItem>,
  ) {}

  async getAll(): Promise<GradeSchemeItem[]> {
    return this.gradeSchemeItemRepository.find({
      where: { isActive: true },
    });
  }

  async create(gradeSchemeItemCreateDto: GradeSchemeItemCreateDto, authorId: number) {
    const gradeSchemeItem = await this.getOneByName(gradeSchemeItemCreateDto.name);
    if (!gradeSchemeItem) throw new BadRequestException('GradeSchemeItem does not exists');

    const gradeSchemeItemCreated = this.gradeSchemeItemRepository.create();
    gradeSchemeItemCreated.createdBy = authorId;
    return gradeSchemeItemCreated;
  }

  async getOneById(idGradeSchemeItem: number): Promise<GradeSchemeItem | null> {
    return this.gradeSchemeItemRepository.findOne({
      where: { idGradeSchemeItem, isActive: true },
    });
  }

  async getOneByName(name: string): Promise<GradeSchemeItem | null> {
    return this.gradeSchemeItemRepository.findOne({
      where: { name, isActive: true },
    });
  }

  async delete(idGradeSchemeItem: number) {
    const gradeSchemeItem = await this.gradeSchemeItemRepository.findOne({
      where: { idGradeSchemeItem, isActive: true },
    });
    if (!gradeSchemeItem) throw new BadRequestException('GradeSchemeItem not found');
    gradeSchemeItem.isActive = false;
    return this.gradeSchemeItemRepository.save(gradeSchemeItem);
  }

  async reactivate(idGradeSchemeItem: number) {
    const gradeSchemeItem = await this.gradeSchemeItemRepository.findOne({
      where: { idGradeSchemeItem, isActive: false },
    });
    if (!gradeSchemeItem) throw new BadRequestException('GradeSchemeItem not found');
    gradeSchemeItem.isActive = true;
    return this.gradeSchemeItemRepository.save(gradeSchemeItem);
  }
}
