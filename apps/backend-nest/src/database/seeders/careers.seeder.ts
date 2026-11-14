import { Career } from 'src/entities/careers/careers.entity';
import { Faculty } from 'src/entities/faculties/faculties.entity';
import { Repository } from 'typeorm';
import { careersData } from '../data/careers.data';
import { CareerSeed } from '../interfaces/careers.interface';
import { requireSeedReference } from '../utils/seed-integrity';

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
    const exists = await this.repository.findOne({ where: { name: data.name }, withDeleted: true });
    if (exists) return exists;
    const faculty = await requireSeedReference(
      this.facultyRepository,
      { name: data.faculty },
      'Facultad',
    );

    const career = this.repository.create({
      name: data.name,
      faculty,
    });

    await this.repository.save(career);
  }
}
