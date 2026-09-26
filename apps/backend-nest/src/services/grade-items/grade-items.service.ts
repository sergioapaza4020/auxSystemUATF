import { GradeItemUpdateDto } from 'src/dtos/grade-items/grade-items-update.dto';
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
    const GradeItem = await this.gradeItemRepository.findOne({
      where: { name: gradeItemCreateDto.name },
    });
    if (GradeItem) throw new BadRequestException('Grade item already exists');

    const GradeItemCreated = this.gradeItemRepository.create({
      name: gradeItemCreateDto.name,
      createdBy: authorId,
    });
    GradeItemCreated.createdBy = authorId;
    return this.gradeItemRepository.save(GradeItemCreated);
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

  async update(idGradeItem: number, dto: GradeItemUpdateDto) {
    const record = await this.gradeItemRepository.findOne({
      where: { idGradeItem, isActive: true },
    });
    if (!record) throw new BadRequestException('GradeItem not found');
    const name = dto.name;
    if (name !== undefined) {
      const duplicate = await this.gradeItemRepository.findOne({ where: { name } });
      if (duplicate && duplicate.idGradeItem !== idGradeItem)
        throw new BadRequestException('GradeItem already exists');
    }

    this.gradeItemRepository.merge(record, dto, name === undefined ? {} : { name });
    return this.gradeItemRepository.save(record);
  }
}
