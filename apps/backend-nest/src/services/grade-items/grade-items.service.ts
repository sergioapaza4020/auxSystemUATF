import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { GradeItemCreateDto } from 'src/dtos/grade-items/grade-items.dto';
import { GradeItem } from 'src/entities/grade-items/grade-items.entity';
import { Repository } from 'typeorm';

@Injectable()
export class GradeItemsService {
  constructor(
    @InjectRepository(GradeItem)
    private readonly GradeItemRepository: Repository<GradeItem>,
  ) {}

  async getAll(): Promise<GradeItem[]> {
    return this.GradeItemRepository.find({
      where: { isActive: true },
    });
  }

  async create(GradeItemCreateDto: GradeItemCreateDto, authorId: number) {
    const GradeItem = await this.getOneByName(GradeItemCreateDto.name);
    if (!GradeItem) throw new BadRequestException('GradeItem does not exists');

    const GradeItemCreated = this.GradeItemRepository.create();
    GradeItemCreated.createdBy = authorId;
    return GradeItemCreated;
  }

  async getOneById(idGradeItem: number): Promise<GradeItem | null> {
    return this.GradeItemRepository.findOne({
      where: { idGradeItem, isActive: true },
    });
  }

  async getOneByName(name: string): Promise<GradeItem | null> {
    return this.GradeItemRepository.findOne({
      where: { name, isActive: true },
    });
  }

  async delete(idGradeItem: number) {
    const GradeItem = await this.GradeItemRepository.findOne({
      where: { idGradeItem, isActive: true },
    });
    if (!GradeItem) throw new BadRequestException('GradeItem not found');
    GradeItem.isActive = false;
    return this.GradeItemRepository.save(GradeItem);
  }

  async reactivate(idGradeItem: number) {
    const GradeItem = await this.GradeItemRepository.findOne({
      where: { idGradeItem, isActive: false },
    });
    if (!GradeItem) throw new BadRequestException('GradeItem not found');
    GradeItem.isActive = true;
    return await this.GradeItemRepository.save(GradeItem);
  }
}
