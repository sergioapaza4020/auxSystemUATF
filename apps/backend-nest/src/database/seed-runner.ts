import { DataSource, EntityManager, QueryFailedError } from 'typeorm';
import { SeedDataError, SeedRowError } from './utils/seed-integrity';
import { PermissionSeeder } from './seeders/permissions.seeder';
import { Permission } from 'src/entities/permissions/permissions.entity';
import { Faculty } from 'src/entities/faculties/faculties.entity';
import { FacultySeeder } from './seeders/faculties.seeder';
import { GradeItem } from 'src/entities/grade-items/grade-items.entity';
import { GradeItemSeeder } from './seeders/grade-items.seeder';
import { GradeSchemeSeeder } from './seeders/grade-schemes.seeder';
import { GradeScheme } from 'src/entities/grade-schemes/grade-schemes.entity';
import { GradeSchemeDetailSeeder } from './seeders/grade-scheme-details.seeder';
import { GradeSchemeDetail } from 'src/entities/grade-scheme-detail/grade-scheme-detail.entity';
import { CourseSeeder } from './seeders/courses.seeder';
import { Course } from 'src/entities/courses/courses.entity';
import { Career } from 'src/entities/careers/careers.entity';
import { CareerSeeder } from './seeders/careers.seeder';
import { Role } from 'src/entities/roles/roles.entity';
import { RoleSeeder } from './seeders/roles.seeder';
import { UserSeeder } from './seeders/users.seeder';
import { User } from 'src/entities/users/users.entity';
import { SemesterSeeder } from './seeders/semesters.seeder';
import { Semester } from 'src/entities/semesters/semester.entity';
import { EnrollmentSeeder } from './seeders/enrollments.seeder';
import { Enrollment } from 'src/entities/enrollments/enrollments.entity';

export interface SeedOptions {
  includeDemoData?: boolean;
  environment?: string;
  log?: (message: string) => void;
}

export class SeedExecutionError extends Error {
  constructor(
    public readonly seeder: string,
    cause: unknown,
  ) {
    let root = cause;
    let row: number | undefined;
    if (root instanceof SeedRowError) {
      row = root.row;
      root = root.cause;
    }
    let context: string;
    if (root instanceof QueryFailedError) {
      const driver = root.driverError as { code?: string; table?: string; constraint?: string };
      // Never emit query parameters, detail, raw messages or the cause's stack.
      context = `SQLSTATE=${driver.code ?? 'unknown'} tabla=${driver.table ?? 'unknown'} constraint=${driver.constraint ?? 'none'} operación=${root.query.trim().split(/\s+/)[0]}`;
      const actions: Record<string, string> = {
        '23505':
          'Conflicto UNIQUE: revisar identidad y clave compuesta; no borrar ni ignorar registros.',
        '23503': 'Referencia FK inválida: revisar registros padre y orden de dependencias.',
        '23502': 'Campo obligatorio ausente: comparar los datos semilla con el esquema migrado.',
        '23514': 'CHECK incumplido: revisar la regla indicada por la restricción.',
        '22P02': 'Formato o ENUM inválido: revisar el catálogo y las migraciones autorizadas.',
        '22P03': 'Representación binaria inválida: revisar los tipos de los parámetros.',
        '22001': 'Longitud excedida: revisar el dato semilla y la longitud de la columna.',
        '42703': 'Columna ausente: revisar el historial y el esquema de migraciones.',
        '42P01': 'Tabla ausente: revisar el historial y el esquema de migraciones.',
        '42704': 'Objeto o tipo ausente: revisar las migraciones autorizadas.',
      };
      context += ` ${actions[driver.code ?? ''] ?? 'Reproducir el fallo en PostgreSQL aislado antes de corregir datos.'}`;
    } else
      context =
        root instanceof SeedDataError
          ? root.message
          : 'Error inesperado; revisar diagnóstico aislado.';
    super(
      `${seeder}${row ? ` fila=${row}` : ''}: ${context} La unidad se revirtió; se detuvo la cadena.`,
      { cause },
    );
  }
}

export async function runSeeders(source: DataSource, options: SeedOptions = {}): Promise<void> {
  if (options.includeDemoData && !['development', 'test'].includes(options.environment ?? '')) {
    throw new SeedDataError(
      'Los usuarios/matrículas demo solo se permiten en development o test con activación explícita.',
    );
  }
  const runner = source.createQueryRunner();
  try {
    if (!(await runner.hasTable('migrations')))
      throw new SeedDataError(
        'Falta el historial de migraciones. Revisar y aplicar las migraciones autorizadas antes del seed.',
      );
  } finally {
    await runner.release();
  }
  if (await source.showMigrations())
    throw new SeedDataError(
      'Hay migraciones pendientes. Revisar y aplicar las migraciones autorizadas antes del seed.',
    );
  const steps = [
    {
      name: 'PermissionSeeder',
      demo: false,
      run: async (manager: EntityManager) => {
        await new PermissionSeeder(manager.getRepository(Permission)).run();
      },
    },
    {
      name: 'FacultySeeder',
      demo: false,
      run: async (manager: EntityManager) => {
        await new FacultySeeder(manager.getRepository(Faculty)).run();
      },
    },
    {
      name: 'GradeItemSeeder',
      demo: false,
      run: async (manager: EntityManager) => {
        await new GradeItemSeeder(manager.getRepository(GradeItem)).run();
      },
    },
    {
      name: 'GradeSchemeSeeder',
      demo: false,
      run: async (manager: EntityManager) => {
        await new GradeSchemeSeeder(manager.getRepository(GradeScheme)).run();
      },
    },
    {
      name: 'SemesterSeeder',
      demo: false,
      run: async (manager: EntityManager) => {
        await new SemesterSeeder(manager.getRepository(Semester)).run();
      },
    },
    {
      name: 'GradeSchemeDetailSeeder',
      demo: false,
      run: async (manager: EntityManager) => {
        await new GradeSchemeDetailSeeder(
          manager.getRepository(GradeSchemeDetail),
          manager.getRepository(GradeScheme),
          manager.getRepository(GradeItem),
        ).run();
      },
    },
    {
      name: 'CareerSeeder',
      demo: false,
      run: async (manager: EntityManager) => {
        await new CareerSeeder(manager.getRepository(Career), manager.getRepository(Faculty)).run();
      },
    },
    {
      name: 'CourseSeeder',
      demo: false,
      run: async (manager: EntityManager) => {
        await new CourseSeeder(
          manager.getRepository(Course),
          manager.getRepository(Career),
          manager.getRepository(GradeScheme),
        ).run();
      },
    },
    {
      name: 'RoleSeeder',
      demo: false,
      run: async (manager: EntityManager) => {
        await new RoleSeeder(manager.getRepository(Role), manager.getRepository(Permission)).run();
      },
    },
    {
      name: 'UserSeeder',
      demo: true,
      run: async (manager: EntityManager) => {
        await new UserSeeder(
          manager.getRepository(User),
          manager.getRepository(Role),
          manager.getRepository(Career),
        ).run();
      },
    },
    {
      name: 'EnrollmentSeeder',
      demo: true,
      run: async (manager: EntityManager) => {
        await new EnrollmentSeeder(
          manager.getRepository(Enrollment),
          manager.getRepository(User),
          manager.getRepository(Course),
          manager.getRepository(Semester),
        ).run();
      },
    },
  ];
  for (const step of steps) {
    if (step.demo && !options.includeDemoData) continue;
    options.log?.(`Iniciando ${step.name}`);
    try {
      await source.transaction(async (manager) => {
        // Serialize concurrent seed commands without changing or disabling constraints.
        await manager.query("SELECT pg_advisory_xact_lock(hashtext('aux-system-seeders'))");
        await step.run(manager);
      });
    } catch (error: unknown) {
      throw new SeedExecutionError(step.name, error);
    }
    options.log?.(`Completado ${step.name}`);
  }
}
