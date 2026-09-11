import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { GradeItemCreateDto } from 'src/dtos/grade-items/grade-items.dto';
import { GradeItem } from 'src/entities/grade-items/grade-items.entity';
import { Repository } from 'typeorm';

@Injectable()
export class GradeItemsService {
  constructor(
    @InjectRepository(GradeItem)
    private readonly gradeItemRepository: Repository<GradeItem>,
  ) {}

  async getAll(): Promise<GradeItem[]> {
    return this.gradeItemRepository.find({
      where: { isActive: true },
    });
  }

  async create(gradeItemCreateDto: GradeItemCreateDto, authorId: number) {
    const GradeItem = await this.getOneByName(GradeItemCreateDto.name);
    if (GradeItem) throw new BadRequestException('Grade item already exists');

    const GradeItemCreated = this.gradeItemRepository.create({
      name: gradeItemCreateDto.name,
      createdBy: authorId,
    });
    GradeItemCreated.createdBy = authorId;
    return GradeItemCreated;
  }

  async getOneById(idGradeItem: number): Promise<GradeItem | null> {
    return this.gradeItemRepository.findOne({
      where: { idGradeItem, isActive: true },
    });
  }

  async getOneByName(name: string): Promise<GradeItem | null> {
    return this.gradeItemRepository.findOne({
      where: { name, isActive: true },
    });
  }

  async delete(idGradeItem: number) {
    const GradeItem = await this.gradeItemRepository.findOne({
      where: { idGradeItem, isActive: true },
    });
    if (!GradeItem) throw new BadRequestException('Grade item not found');
    GradeItem.isActive = false;
    return this.gradeItemRepository.save(GradeItem);
  }

  async reactivate(idGradeItem: number) {
    const GradeItem = await this.gradeItemRepository.findOne({
      where: { idGradeItem, isActive: false },
    });
    if (!GradeItem) throw new BadRequestException('Grade item not found');
    GradeItem.isActive = true;
    return await this.gradeItemRepository.save(GradeItem);
  }
}
