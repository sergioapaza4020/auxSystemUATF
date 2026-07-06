import { Career } from 'src/entities/careers/careers.entity';
import { Faculty } from 'src/entities/faculties/faculties.entity';
import { DeepPartial, Repository } from 'typeorm';
import { careersData } from '../data/careers.data';

export class CareerSeeder {
  constructor(
    private readonly repository: Repository<Career>,
    private readonly facultyRepository: Repository<Faculty>,
  ) {}

  async run() {
    for (const careerData of careersData) {
      await this.createCareer(careerData);
    }
  }
  async createCareer(career: DeepPartial<Career>) {
    const faculty = await this.facultyRepository.findOneBy({
      name: career.faculty?.name,
    });

    if (!faculty) throw new Error('Faculty not found');

    const exists = await this.repository.findOneBy({
      name: career.name,
    });

    if (exists) {
      console.log(`Career ${career.name} already exists`);
      return;
    }

    await this.repository.save(
      this.repository.create({
        ...Career,
        name: career.name,
        faculty,
      }),
    );
  }
}
