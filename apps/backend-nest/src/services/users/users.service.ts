import { UserUpdateDto } from 'src/dtos/users/users-update.dto';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { UserCreateDto } from 'src/dtos/users/users.dto';
import { User } from 'src/entities/users/users.entity';
import { Repository } from 'typeorm';

import * as bcrypt from 'bcrypt';

import { RolesService } from '../roles/roles.service';
import { UserQueryDto } from 'src/dtos/users/user-query.dto';
import { statusFilter } from '@common/utils/status-filter';

import * as ExcelJS from 'exceljs';
import { UserImportRowDto } from 'src/dtos/users/users-import.dto';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { BulkOperationsService } from '../bulk-operations/bulk-operations.service';
import { BulkOperationStatus, BulkOperationType } from '@common/enums/bulk-operation';
import { UserImportPreviewQueryDto } from 'src/dtos/users/users-import-preview.dto';
import type { UserImportPreview } from 'src/dtos/users/users-import-preview.dto';
import { toUserImportPreviewRow, userImportSearchCondition } from './users-import-preview';
import {
  validateUserImportRole,
  userImportRequiresRu,
  userImportUsername,
} from './user-import-rules';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    private readonly rolesService: RolesService,
    private readonly bulkOperations: BulkOperationsService,
  ) {}

  private readonly logger = new Logger(UsersService.name);

  async getAll(query: UserQueryDto) {
    const { careerId, search, role, page = 1, limit = 20 } = query;
    const qb = this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.careers', 'career')
      .leftJoinAndSelect('user.roles', 'roles')
      .where(statusFilter(query.status))
      .orderBy('user.idUser', 'ASC');

    if (careerId) qb.andWhere('career.idCareer = :careerId', { careerId });

    if (search)
      qb.andWhere(
        `
        (user.username ILIKE :search
        OR user.name ILIKE :search
        OR user.lastname ILIKE :search
        OR user.ru ILIKE :search
        OR user.ci ILIKE :search)
        `,
        { search: `%${search}%` },
      );

    if (role) {
      qb.andWhere('roles.name IN (:...roles)', {
        roles: role,
      });
    }

    qb.skip((page - 1) * limit);
    qb.take(limit);
    const [data, total] = await qb.getManyAndCount();
    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async create(userCreateDto: UserCreateDto): Promise<User> {
    const user = await this.userRepository.findOne({
      where: [{ email: userCreateDto.email }, { username: userCreateDto.username }],
    });
    if (user) throw new BadRequestException('User already exists');

    const roles = await Promise.all(
      userCreateDto.roleNames.map(async (name) => {
        const role = await this.rolesService.getOneByName(name.toUpperCase());
        if (!role) throw new BadRequestException(`Role not found: ${name}`);
        return role;
      }),
    );
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(userCreateDto.password, salt);
    const userCreated = this.userRepository.create({
      ...userCreateDto,
      password: hash,
      roles,
    });
    userCreated.createdBy = 0;
    return this.userRepository.save(userCreated);
  }

  async getOneByEmail(email: string) {
    return this.userRepository.findOne({
      where: { email, isActive: true },
      relations: {
        roles: {
          permissions: true,
        },
      },
    });
  }

  async getOneByUsername(username: string) {
    return this.userRepository.findOne({
      where: { username, isActive: true },
      relations: {
        roles: {
          permissions: true,
        },
      },
    });
  }

  async getForAuthentication(username: string) {
    return this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .leftJoinAndSelect('user.roles', 'roles')
      .leftJoinAndSelect('roles.permissions', 'permissions')
      .where('user.username = :username AND user.isActive = :isActive', {
        username,
        isActive: true,
      })
      .getOne();
  }

  async getOneById(idUser: number) {
    return this.userRepository.findOne({
      where: { idUser, isActive: true },
      relations: {
        roles: {
          permissions: true,
        },
        enrollments: true,
      },
    });
  }

  async assignRoles(idUser: number, roleNames: string[]) {
    const user = await this.userRepository.findOne({
      where: { idUser, isActive: true },
      relations: ['roles'],
    });
    if (!user) throw new BadRequestException('User not found');
    for (const rn of roleNames) {
      const role = await this.rolesService.getOneByName(rn.toUpperCase());
      if (!role) throw new BadRequestException(`Role not found: ${rn}`);

      const alreadyAssigned = user.roles?.some((r) => r.name === rn);
      if (alreadyAssigned) throw new BadRequestException(`Role not found: ${rn}`);

      user.roles?.push(role);
    }

    user.updatedAt = new Date();
    return this.userRepository.save(user);
  }

  async delete(idUser: number) {
    const user = await this.userRepository.findOne({
      where: { idUser: idUser, isActive: true },
    });
    if (!user) throw new BadRequestException('User not found');
    user.isActive = false;
    return this.userRepository.save(user);
  }

  async reactivate(idUser: number) {
    const user = await this.userRepository.findOne({
      where: { idUser: idUser, isActive: false },
    });
    if (!user) throw new BadRequestException('User not found');
    user.isActive = true;
    return this.userRepository.save(user);
  }

  async update(idUser: number, dto: UserUpdateDto) {
    const user = await this.userRepository.findOne({ where: { idUser, isActive: true } });
    if (!user) throw new BadRequestException('User not found');
    for (const field of ['email', 'username'] as const) {
      if (dto[field] !== undefined) {
        const duplicate = await this.userRepository.findOne({ where: { [field]: dto[field] } });
        if (duplicate && duplicate.idUser !== idUser)
          throw new BadRequestException(`${field} already exists`);
      }
    }
    // Explicit fields keep role assignment behind its own permission.
    const { email, username, name, lastname, ci, ru, password } = dto;
    this.userRepository.merge(user, { email, username, name, lastname, ci, ru });
    if (password !== undefined) user.password = await bcrypt.hash(password, 10);
    const saved = await this.userRepository.save(user);
    return {
      idUser: saved.idUser,
      email: saved.email,
      username: saved.username,
      name: saved.name,
      lastname: saved.lastname,
      ci: saved.ci,
      ru: saved.ru,
      isActive: saved.isActive,
    };
  }

  private validateImportRole(roleName: string): string {
    return validateUserImportRole(roleName);
  }

  private requiresRu(roleName: string): boolean {
    return userImportRequiresRu(roleName.toUpperCase());
  }

  private getImportUsername(roleName: string, ci: string, ru: string): string {
    return userImportUsername(roleName, ci, ru);
  }

  private async processImportFile(file: Express.Multer.File, roleName: string) {
    const normalizedRoleName = this.validateImportRole(roleName);

    if (!file) {
      throw new BadRequestException('Excel file is required');
    }

    const workbook = new ExcelJS.Workbook();

    const excelBuffer = file.buffer.buffer.slice(
      file.buffer.byteOffset,
      file.buffer.byteOffset + file.buffer.byteLength,
    );

    await workbook.xlsx.load(excelBuffer as ArrayBuffer);

    const worksheet = workbook.worksheets[0];

    if (!worksheet) {
      throw new BadRequestException('Excel file does not contain worksheets');
    }

    const expectedHeaders = ['Nombres', 'Apellidos', 'CI', 'RU', 'Email'];

    const headerRow = worksheet.getRow(1);

    const actualHeaders = expectedHeaders.map((_, index) =>
      headerRow.getCell(index + 1).text.trim(),
    );

    const invalidHeaders = expectedHeaders.filter(
      (expected, index) => actualHeaders[index] !== expected,
    );

    if (invalidHeaders.length > 0) {
      throw new BadRequestException({
        message: 'El formato del archivo Excel no es válido',
        expectedHeaders,
        actualHeaders,
      });
    }

    const rows: {
      row: number;
      name: string;
      lastname: string;
      ci: string;
      ru: string;
      email: string;
      username: string;
      valid: boolean;
      errors: string[];
    }[] = [];

    worksheet.eachRow((excelRow, rowNumber) => {
      // Primera fila = encabezados
      if (rowNumber === 1) {
        return;
      }

      const name = excelRow.getCell(1).text.trim();
      const lastname = excelRow.getCell(2).text.trim();
      const ci = excelRow.getCell(3).text.trim();
      const ru = excelRow.getCell(4).text.trim();
      const email = excelRow.getCell(5).text.trim().toLowerCase();

      // Ignorar filas completamente vacías
      if (!name && !lastname && !ci && !ru && !email) {
        return;
      }

      rows.push({
        row: rowNumber,
        name,
        lastname,
        ci,
        ru,
        email: email.toLowerCase(),
        username: this.getImportUsername(normalizedRoleName, ci, ru),
        valid: true,
        errors: [],
      });
    });

    if (rows.length === 0) {
      throw new BadRequestException('El archivo excel no contiene la información del usuario');
    }

    /*
     * 1. Validación de DTO.
     */
    for (const row of rows) {
      const dto = plainToInstance(UserImportRowDto, {
        name: row.name,
        lastname: row.lastname,
        ci: row.ci,
        ru: row.ru,
        email: row.email,
      });

      const validationErrors = await validate(dto);

      for (const error of validationErrors) {
        if (!error.constraints) continue;

        if (error.property === 'email') {
          row.errors.push('El email no es válido');
          continue;
        }

        if (error.property === 'name') {
          row.errors.push('Los nombres son obligatorios');
          continue;
        }

        if (error.property === 'lastname') {
          row.errors.push('Los apellidos son obligatorios');
          continue;
        }

        if (error.property === 'ci') {
          row.errors.push('El CI es obligatorio');
          continue;
        }
      }

      if (this.requiresRu(normalizedRoleName) && !row.ru) {
        row.errors.push(`El RU es obligatorio para usuarios con rol ${normalizedRoleName}`);
      }
    }

    /*
     * 2. Detectar duplicados dentro del propio Excel.
     */
    const ciCount = new Map<string, number>();
    const ruCount = new Map<string, number>();
    const emailCount = new Map<string, number>();

    for (const row of rows) {
      if (row.ci) {
        ciCount.set(row.ci, (ciCount.get(row.ci) ?? 0) + 1);
      }

      if (row.ru) {
        ruCount.set(row.ru, (ruCount.get(row.ru) ?? 0) + 1);
      }

      if (row.email) {
        emailCount.set(row.email, (emailCount.get(row.email) ?? 0) + 1);
      }
    }

    for (const row of rows) {
      if (row.ci && (ciCount.get(row.ci) ?? 0) > 1) {
        row.errors.push('El CI está duplicado dentro del archivo');
      }

      if (row.ru && (ruCount.get(row.ru) ?? 0) > 1) {
        row.errors.push('El RU está duplicado dentro del archivo');
      }

      if (row.email && (emailCount.get(row.email) ?? 0) > 1) {
        row.errors.push('El email está duplicado dentro del archivo');
      }
    }

    /*
     * 3. Buscar conflictos con usuarios existentes.
     *
     * Hacemos consultas por conjunto, no una consulta por cada fila.
     */
    const cis = [...new Set(rows.map((row) => row.ci).filter(Boolean))];
    const rus = [...new Set(rows.map((row) => row.ru).filter(Boolean))];
    const emails = [...new Set(rows.map((row) => row.email).filter(Boolean))];
    const usernames = [...new Set(rows.map((row) => row.username).filter(Boolean))];

    const existingUsersQuery = this.userRepository
      .createQueryBuilder('user')
      .select(['user.idUser', 'user.ci', 'user.ru', 'user.email', 'user.username']);

    const conditions: string[] = [];
    const parameters: Record<string, string[]> = {};

    if (cis.length > 0) {
      conditions.push('user.ci IN (:...cis)');
      parameters.cis = cis;
    }

    if (rus.length > 0) {
      conditions.push('user.ru IN (:...rus)');
      parameters.rus = rus;
    }

    if (emails.length > 0) {
      conditions.push('LOWER(user.email) IN (:...emails)');
      parameters.emails = emails;
    }

    if (usernames.length > 0) {
      conditions.push('user.username IN (:...usernames)');
      parameters.usernames = usernames;
    }

    const existingUsers =
      conditions.length > 0
        ? await existingUsersQuery.where(conditions.join(' OR '), parameters).getMany()
        : [];

    const existingCis = new Set(existingUsers.map((user) => user.ci));

    const existingRus = new Set(
      existingUsers.map((user) => user.ru).filter((ru): ru is string => Boolean(ru)),
    );

    const existingEmails = new Set(existingUsers.map((user) => user.email.toLowerCase()));

    const existingUsernames = new Set(existingUsers.map((user) => user.username));

    for (const row of rows) {
      if (existingCis.has(row.ci)) {
        row.errors.push('Ya existe un usuario con este CI');
      }

      if (existingRus.has(row.ru)) {
        row.errors.push('Ya existe un usuario con este RU');
      }

      if (existingEmails.has(row.email)) {
        row.errors.push('Ya existe un usuario con este email');
      }

      if (existingUsernames.has(row.username)) {
        row.errors.push('Ya existe un usuario con este username');
      }

      row.valid = row.errors.length === 0;
    }

    const valid = rows.filter((row) => row.valid).length;
    const invalid = rows.length - valid;

    return {
      total: rows.length,
      valid,
      invalid,
      rows,
    };
  }

  async previewImport(
    file: Express.Multer.File,
    roleName: string,
    ownerId: number,
  ): Promise<UserImportPreview> {
    const normalizedRoleName = this.validateImportRole(roleName);
    if (!file) throw new BadRequestException('Excel file is required');
    if (!/\.xlsx$/i.test(file.originalname))
      throw new BadRequestException('El archivo debe tener extensión .xlsx');
    if (!file.buffer.length || file.buffer.length > 5 * 1024 * 1024) {
      throw new BadRequestException('El archivo debe contener datos y no superar los 5 MB');
    }
    const operation = await this.bulkOperations.create(
      {
        type: BulkOperationType.USER_IMPORT,
        metadata: { roleName: normalizedRoleName, originalFileName: file.originalname },
      },
      ownerId,
    );
    try {
      await this.bulkOperations.update(operation.idBulkOperation, ownerId, {
        status: BulkOperationStatus.PROCESSING,
        startedAt: new Date(),
      });
      const preview = await this.processImportFile(file, normalizedRoleName);
      await this.bulkOperations.saveRows(
        operation.idBulkOperation,
        ownerId,
        preview.rows.map((row) => ({
          rowNumber: row.row,
          valid: row.valid,
          errors: row.errors,
          data: {
            name: row.name,
            lastname: row.lastname,
            ci: row.ci,
            ru: row.ru,
            email: row.email,
            username: row.username,
          },
        })),
      );
      await this.bulkOperations.update(operation.idBulkOperation, ownerId, {
        status: BulkOperationStatus.READY,
      });
    } catch (error) {
      try {
        await this.bulkOperations.update(operation.idBulkOperation, ownerId, {
          status: BulkOperationStatus.FAILED,
        });
      } catch {
        this.logger.warn('No se pudo marcar el preview de usuarios como FAILED');
      }
      throw error;
    }
    return this.getImportPreview(operation.idBulkOperation, ownerId);
  }

  async getImportPreview(
    operationId: string,
    ownerId: number,
    query = new UserImportPreviewQueryDto(),
  ): Promise<UserImportPreview> {
    const { page = 1, limit = 25, status = 'all', search } = query;
    const operation = await this.bulkOperations.getById(operationId, ownerId);
    if (operation.type !== BulkOperationType.USER_IMPORT)
      throw new NotFoundException('User import preview not found');
    if (operation.status !== BulkOperationStatus.READY)
      throw new BadRequestException('User import preview is not ready');
    const rows = await this.bulkOperations.findRows(
      operationId,
      ownerId,
      {
        page,
        limit,
        valid: status === 'all' ? undefined : status === 'valid',
      },
      userImportSearchCondition(search),
    );
    return {
      operationId,
      total: operation.totalRows,
      valid: operation.validRows,
      invalid: operation.invalidRows,
      data: rows.data.map(toUserImportPreviewRow),
      meta: rows.meta,
    };
  }

  async generateImportTemplate(roleName: string): Promise<Buffer> {
    const normalizedRoleName = this.validateImportRole(roleName);

    const role = await this.rolesService.getOneByName(normalizedRoleName);

    if (!role) {
      throw new BadRequestException(`Rol ${normalizedRoleName} no encontrado`);
    }

    const ruRequired = this.requiresRu(normalizedRoleName);

    const workbook = new ExcelJS.Workbook();

    const worksheet = workbook.addWorksheet('Usuarios');

    worksheet.columns = [
      {
        header: 'Nombres',
        key: 'name',
        width: 25,
      },
      {
        header: 'Apellidos',
        key: 'lastname',
        width: 25,
      },
      {
        header: 'CI',
        key: 'ci',
        width: 18,
      },
      {
        header: 'RU',
        key: 'ru',
        width: 18,
      },
      {
        header: 'Email',
        key: 'email',
        width: 35,
      },
    ];

    worksheet.getColumn('ci').numFmt = '@';
    worksheet.getColumn('ru').numFmt = '@';

    const instructions = workbook.addWorksheet('Instrucciones');

    instructions.getColumn(1).width = 90;

    instructions.addRow(['IMPORTACIÓN DE USUARIOS']);
    instructions.addRow([]);
    instructions.addRow([`Rol asignado: ${normalizedRoleName}`]);
    instructions.addRow([]);
    instructions.addRow(['• No modifique los nombres ni el orden de las columnas.']);
    instructions.addRow(['• Nombres, Apellidos, CI y Email son obligatorios.']);
    instructions.addRow(['• El CI debe ser único.']);
    instructions.addRow(['• El email debe ser válido y único.']);

    if (ruRequired) {
      instructions.addRow([`• El RU es obligatorio para usuarios con rol ${normalizedRoleName}.`]);
      instructions.addRow(['• El RU debe ser único.']);
      instructions.addRow(['• El RU será utilizado como nombre de usuario.']);
    } else {
      instructions.addRow([`• El RU es opcional para usuarios con rol ${normalizedRoleName}.`]);
      instructions.addRow(['• El CI será utilizado como nombre de usuario.']);
    }

    instructions.addRow(['• El CI será utilizado como contraseña inicial.']);

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }
}
