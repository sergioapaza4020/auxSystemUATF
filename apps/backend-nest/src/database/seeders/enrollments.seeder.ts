import { Repository } from 'typeorm';
import { enrollmentsData } from '../data/enrollments.data';
import { Enrollment } from 'src/entities/enrollments/enrollments.entity';
import { Course } from 'src/entities/courses/courses.entity';
import { Semester } from 'src/entities/semesters/semester.entity';
import { User } from 'src/entities/users/users.entity';
import { EnrollmentSeed } from '../interfaces/enrollments.interface';
import { SemesterNumber } from '@common/enums/semesterNumber';
import { findSeedRecord, SeedDataError, SeedRowError } from '../utils/seed-integrity';

export class EnrollmentSeeder {
  constructor(
    private readonly repository: Repository<Enrollment>,
    private readonly userRepository: Repository<User>,
    private readonly courseRepository: Repository<Course>,
    private readonly SemesterRepository: Repository<Semester>,
  ) {}

  async run() {
    for (const [index, item] of enrollmentsData.entries()) {
      try {
        await this.create(item);
      } catch (error: unknown) {
        throw new SeedRowError(index + 1, error);
      }
    }
  }

  async create(data: EnrollmentSeed) {
    const user = await this.userRepository.findOne({
      where: { username: data.user },
      withDeleted: true,
      relations: { roles: true },
    });
    if (!user)
      throw new SeedDataError('Matrícula: usuario no encontrado; revisar el seeder de usuarios.');
    const match = /^(I|II)-(\d{4})$/.exec(data.semester);
    if (!match)
      throw new SeedDataError('Matrícula: semestre inválido; se espera I-AAAA o II-AAAA.');
    const semester = await findSeedRecord(
      this.SemesterRepository,
      { period: match[1] as SemesterNumber, year: Number(match[2]) },
      'Semestre',
    );
    const course = await findSeedRecord(
      this.courseRepository,
      { code: data.courseCode, group: data.courseGroup },
      'Materia/grupo',
    );

    if (!semester || !course)
      throw new SeedDataError(
        'Matrícula: falta el semestre o la materia/grupo; revisar seeders padre.',
      );

    // Only the three FK identities define the unique enrollment. Never compare loaded
    // entities: their personal fields, relations and sub-millisecond timestamps differ.
    const exists = await findSeedRecord(
      this.repository,
      {
        user: { idUser: user.idUser },
        semester: { idSemester: semester.idSemester },
        course: { idCourse: course.idCourse },
      },
      'Matrícula',
    );
    if (exists) {
      if (exists.role !== data.role)
        throw new SeedDataError(
          'Matrícula: el destino ya tiene otra participación; no se convertirá.',
        );
      return exists; // Preserve inactive/deleted enrollments and all academic history.
    }
    if (!semester.isActive || semester.deletedAt || !course.isActive || course.deletedAt) {
      throw new SeedDataError(
        'Matrícula: semestre o materia inactivos; no se crearán relaciones nuevas.',
      );
    }
    if (!user.isActive || user.deletedAt)
      throw new SeedDataError('Matrícula: usuario inactivo o eliminado; no se reactivará.');
    if (
      !user.roles.some(
        (role) => role.name === String(data.role) && role.isActive && !role.deletedAt,
      )
    ) {
      throw new SeedDataError(
        'Matrícula: el usuario no tiene el rol activo requerido; no se otorgarán roles.',
      );
    }

    const enrollment = this.repository.create({
      semester,
      course,
      user,
      role: data.role,
    });

    return this.repository.save(enrollment);
  }
}
