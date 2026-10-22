import { BadRequestException, ConflictException } from '@nestjs/common';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { AssistantGradeSchemesService } from './assistant-grade-schemes.service';
import { GradeSchemesService } from './grade-schemes.service';
import { GradeItem } from 'src/entities/grade-items/grade-items.entity';
import { GradeScheme } from 'src/entities/grade-schemes/grade-schemes.entity';
import { GradeSchemeDetail } from 'src/entities/grade-scheme-detail/grade-scheme-detail.entity';
import { Enrollment } from 'src/entities/enrollments/enrollments.entity';
import { AssistantGradeSchemeCreateDto } from 'src/dtos/assistant-grade-schemes/assistant-grade-scheme.dto';

function fixture(names: string[], offset = 701) {
  const items = names.map((name, index) => ({
    idGradeItem: offset + index * 17,
    name,
    isActive: true,
  }));
  const dto: AssistantGradeSchemeCreateDto = {
    assistantPercentage: 20,
    details: items.map((gradeItem, index) => ({
      gradeItem: { idGradeItem: gradeItem.idGradeItem },
      percentage: index === 0 ? 100 : 0,
      order: index + 1,
    })),
  };
  const existing: Partial<GradeSchemeDetail>[] = [];
  const scheme = { idGradeScheme: 93, assistantEnrollment: { idEnrollment: 81 } };
  const schemes = {
    findOne: jest.fn<Promise<unknown>, unknown[]>().mockResolvedValue(scheme),
    create: jest.fn((value: unknown) => value),
    save: jest.fn((value: unknown) => Promise.resolve(value)),
  };
  const query = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    setLock: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(existing),
  };
  const details = {
    create: jest.fn((value: unknown) => value),
    save: jest.fn((value: unknown) => Promise.resolve(value)),
    delete: jest.fn().mockResolvedValue(undefined),
    createQueryBuilder: jest.fn(() => query),
  };
  const catalog = {
    find: jest.fn().mockResolvedValue(items),
    findOne: jest.fn(({ where }: { where: { idGradeItem: number } }) =>
      Promise.resolve(items.find((item) => item.idGradeItem === where.idGradeItem)),
    ),
  };
  const enrollment = { find: jest.fn().mockResolvedValue([{ idEnrollment: 81 }]) };
  const records = {
    countBy: jest.fn().mockResolvedValue(0),
    count: jest.fn().mockResolvedValue(0),
  };
  const manager = {
    getRepository: (entity: unknown) => {
      if (entity === GradeScheme) return schemes;
      if (entity === GradeSchemeDetail) return details;
      if (entity === GradeItem) return catalog;
      return records;
    },
  } as unknown as EntityManager;
  const transaction = jest.fn((work: (manager: EntityManager) => Promise<unknown>) =>
    work(manager),
  );
  const dataSource = { transaction } as unknown as DataSource;
  Object.assign(schemes, { manager });
  const args = [
    schemes as unknown as Repository<GradeScheme>,
    details as unknown as Repository<GradeSchemeDetail>,
    enrollment as unknown as Repository<Enrollment>,
    dataSource,
  ] as const;
  const assistant = new AssistantGradeSchemesService(...args);
  const general = new GradeSchemesService(...args);
  const create = () => {
    schemes.findOne.mockResolvedValueOnce(null);
    return assistant.create(11, 12, dto);
  };
  return {
    items,
    dto,
    schemes,
    details,
    catalog,
    existing,
    records,
    assistant,
    general,
    create,
    transaction,
  };
}

describe('AssistantGradeScheme criteria', () => {
  it.each([
    'Prácticas',
    'Laboratorio',
    'Asistencia',
    'Asistencias',
    'Participación',
    ' PRACTICAS ',
    'participacion',
  ])('allows %s alone, using the persisted name and arbitrary IDs', async (name) => {
    for (const offset of [701, 42019]) {
      const f = fixture([name], offset);
      await f.create();
      expect(f.details.save).toHaveBeenCalledWith([
        expect.objectContaining({ gradeItem: { idGradeItem: offset }, percentage: 100 }),
      ]);
      expect(f.schemes.save).toHaveBeenCalledWith(
        expect.objectContaining({ assistantPercentage: 20 }),
      );
    }
  });

  it.each([
    'Examen final',
    'Parcial',
    'Parciales',
    'Segundo turno',
    'Recuperatorio',
    'Exámenes',
    'Proyecto',
  ])('rejects %s on create and update before writes', async (name) => {
    const f = fixture([name]);
    await expect(f.create()).rejects.toThrow(
      'El criterio seleccionado no está permitido en la configuración del auxiliar.',
    );
    await expect(f.assistant.update(11, 93, f.dto)).rejects.toThrow(BadRequestException);
    expect(f.schemes.save).not.toHaveBeenCalled();
    expect(f.details.save).not.toHaveBeenCalled();
    expect(f.details.delete).not.toHaveBeenCalled();
  });

  it('rejects mixtures, including a forged allowed name in the request', async () => {
    const f = fixture(['Prácticas', 'Examen final']);
    Object.assign(f.dto.details[1].gradeItem, { name: 'Laboratorio' });
    await expect(f.create()).rejects.toThrow(BadRequestException);
    await expect(f.assistant.update(11, 93, f.dto)).rejects.toThrow(BadRequestException);
    expect(f.details.save).not.toHaveBeenCalled();
  });

  it('validates retained criteria too, without deleting incompatible history', async () => {
    const f = fixture(['Examen final']);
    f.existing.push({ idGradeSchemeDetail: 300, gradeItem: f.items[0] as GradeItem });
    await expect(f.assistant.update(11, 93, f.dto)).rejects.toThrow(BadRequestException);
    expect(f.details.delete).not.toHaveBeenCalled();
  });

  it('rejects a missing ID with a domain error on create and update', async () => {
    const f = fixture(['Prácticas']);
    f.catalog.find.mockResolvedValue([]);
    await expect(f.create()).rejects.toThrow('Ítem de calificación inexistente o inactivo');
    await expect(f.assistant.update(11, 93, f.dto)).rejects.toThrow(BadRequestException);
  });

  it('preserves duplicate and total percentage validation', async () => {
    const f = fixture(['Prácticas']);
    f.dto.details.push({ ...f.dto.details[0], percentage: 0 });
    await expect(f.create()).rejects.toThrow(BadRequestException);
    await expect(f.assistant.update(11, 93, f.dto)).rejects.toThrow(BadRequestException);
    f.dto.details.pop();
    f.dto.details[0].percentage = 99;
    await expect(f.create()).rejects.toThrow('debe sumar exactamente 100%');
    await expect(f.assistant.update(11, 93, f.dto)).rejects.toThrow('debe sumar exactamente 100%');
  });

  it('updates a subset while retaining detail IDs and attendance settings', async () => {
    const f = fixture(['Prácticas', 'Asistencias']);
    f.dto.details[0].percentage = 70;
    f.dto.details[1].percentage = 30;
    f.existing.push(
      ...f.items.map((gradeItem, index) => ({
        idGradeSchemeDetail: 300 + index,
        gradeItem: gradeItem as GradeItem,
        permissionWeight: 0.5,
      })),
    );
    await f.assistant.update(11, 93, f.dto);
    expect(f.details.save).toHaveBeenCalledWith([
      expect.objectContaining({ idGradeSchemeDetail: 300, percentage: 70 }),
      expect.objectContaining({ idGradeSchemeDetail: 301, percentage: 30, permissionWeight: 0.5 }),
    ]);
  });

  it('returns active criteria separately from archived history with deletion impact', async () => {
    const f = fixture(['Prácticas']);
    f.schemes.findOne.mockResolvedValue({
      idGradeScheme: 93,
      assistantEnrollment: { idEnrollment: 81 },
      details: [
        { idGradeSchemeDetail: 300, isActive: true, gradeItem: f.items[0], activities: [] },
        {
          idGradeSchemeDetail: 301,
          isActive: false,
          gradeItem: { name: 'Laboratorio' },
          activities: [],
        },
      ],
    });
    f.records.count.mockResolvedValue(1);
    const response = await f.assistant.getMyScheme(11, 12);
    expect(response?.details).toEqual([
      expect.objectContaining({ idGradeSchemeDetail: 300, hasAcademicData: true }),
    ]);
    expect(response?.archivedDetails).toEqual([
      expect.objectContaining({ idGradeSchemeDetail: 301 }),
    ]);
    expect(f.records.count).toHaveBeenCalledWith(expect.objectContaining({ withDeleted: true }));
  });

  it('propagates a failed write through the single transaction instead of committing partially', async () => {
    const f = fixture(['Prácticas']);
    f.existing.push({
      idGradeSchemeDetail: 300,
      gradeItem: { idGradeItem: 919, name: 'Laboratorio' } as GradeItem,
    });
    f.details.save.mockRejectedValueOnce(new Error('write failed'));
    await expect(
      f.assistant.update(11, 93, { ...f.dto, deactivateDetailIds: [300] }),
    ).rejects.toThrow('write failed');
    expect(f.transaction).toHaveBeenCalledTimes(1);
    expect(f.details.delete).not.toHaveBeenCalled();
  });

  it('deletes an unused criterion after explicit redistribution', async () => {
    const f = fixture(['Prácticas']);
    f.existing.push({
      idGradeSchemeDetail: 300,
      gradeItem: { idGradeItem: 919, name: 'Laboratorio' } as GradeItem,
    });
    await f.assistant.update(11, 93, f.dto);
    expect(f.details.delete).toHaveBeenCalledWith(300);
  });

  it.each(['grades', 'activities', 'attendance'])(
    'archives %s history only with explicit authorization',
    async (kind) => {
      const f = fixture(['Prácticas']);
      f.existing.push({
        idGradeSchemeDetail: 300,
        percentage: 30,
        gradeItem: {
          idGradeItem: 919,
          name: kind === 'attendance' ? 'Asistencias' : 'Laboratorio',
        } as GradeItem,
      });
      if (kind === 'activities') f.records.count.mockResolvedValue(1);
      else f.records.countBy.mockResolvedValue(1);
      await expect(f.assistant.update(11, 93, f.dto)).rejects.toThrow(ConflictException);
      await f.assistant.update(11, 93, { ...f.dto, deactivateDetailIds: [300] });
      expect(f.details.delete).not.toHaveBeenCalled();
      expect(f.details.save).toHaveBeenCalledWith(
        expect.objectContaining({
          idGradeSchemeDetail: 300,
          percentage: 30,
          isActive: false,
        }),
      );
      expect(f.existing[0].archivedAt).toBeInstanceOf(Date);
      expect(f.schemes.save).toHaveBeenCalledWith(expect.objectContaining({ updatedBy: 11 }));
    },
  );

  it('rejects fractional redistribution that the integer storage cannot represent', async () => {
    const f = fixture(['Prácticas', 'Laboratorio']);
    f.dto.details[0].percentage = 70.5;
    f.dto.details[1].percentage = 29.5;
    await expect(f.assistant.update(11, 93, f.dto)).rejects.toThrow('deben ser enteros');
    expect(f.schemes.save).not.toHaveBeenCalled();
  });

  it('rejects invalid redistribution before any writes', async () => {
    const f = fixture(['Prácticas']);
    f.dto.details[0].percentage = 70;
    await expect(
      f.assistant.update(11, 93, { ...f.dto, deactivateDetailIds: [300] }),
    ).rejects.toThrow(BadRequestException);
    expect(f.details.save).not.toHaveBeenCalled();
    expect(f.details.delete).not.toHaveBeenCalled();
    expect(f.schemes.save).not.toHaveBeenCalled();
  });

  it('rejects foreign criteria and implicit reactivation', async () => {
    const f = fixture(['Prácticas']);
    await expect(
      f.assistant.update(11, 93, { ...f.dto, deactivateDetailIds: [999] }),
    ).rejects.toThrow(BadRequestException);
    f.existing.push({
      idGradeSchemeDetail: 300,
      isActive: false,
      gradeItem: f.items[0] as GradeItem,
    });
    await expect(f.assistant.update(11, 93, f.dto)).rejects.toThrow('no puede reactivarse');
    expect(f.details.save).not.toHaveBeenCalled();
  });

  it('keeps the protection against removing criteria with grades or activities', async () => {
    const f = fixture(['Prácticas']);
    f.existing.push({
      idGradeSchemeDetail: 300,
      gradeItem: { idGradeItem: 919, name: 'Laboratorio' } as GradeItem,
    });
    f.records.countBy.mockResolvedValue(1);
    await expect(f.assistant.update(11, 93, f.dto)).rejects.toThrow(ConflictException);
    expect(f.details.delete).not.toHaveBeenCalled();
  });

  it('prevents bypass via general update for assistant schemes only', async () => {
    const f = fixture(['Examen final']);
    const dto = { name: 'Esquema', details: f.dto.details };
    await expect(f.general.update(93, dto)).rejects.toThrow(BadRequestException);
    expect(f.schemes.save).not.toHaveBeenCalled();
    f.schemes.findOne.mockResolvedValue({ idGradeScheme: 94, assistantEnrollment: null });
    await expect(f.general.update(94, dto)).resolves.toBeDefined();
    expect(f.details.save).toHaveBeenCalled();
  });
});
