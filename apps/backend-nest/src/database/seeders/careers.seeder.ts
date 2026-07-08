import { Career } from 'src/entities/careers/careers.entity';
import { Faculty } from 'src/entities/faculties/faculties.entity';
import { Repository } from 'typeorm';
import { careersData } from '../data/careers.data';
import { CareerSeed } from '../interfaces/careers.interface';

export class CareerSeeder {
  constructor(
    private readonly repository: Repository<Career>,
    private readonly facultyRepository: Repository<Faculty>,
  ) {}

  async run() {
    for (const item of careersData) {
      await this.create(item);
    }
  }
  async create(data: CareerSeed) {
    const faculty = await this.facultyRepository.findOne({
      where: {
        name: data.faculty,
      },
    });

    if (!faculty) throw new Error(`Faculty ${data.faculty} not found`);

    const exists = await this.repository.findOne({
      where: {
        name: data.name,
      },
    });

    if (exists) {
      console.log(`Career ${data.name} already exists`);
      return;
    }

    const career = this.repository.create({
      name: data.name,
      faculty,
    });

    await this.repository.save(career);
  }
}
