import { BadRequestException } from '@nestjs/common';
import { isAssistantGradeItem } from '@repo/grade-calculations/assistant-grade-items';
import { GradeItem } from 'src/entities/grade-items/grade-items.entity';
import { EntityManager, In } from 'typeorm';

export async function validateAssistantGradeItems(
  manager: EntityManager,
  details: readonly { gradeItem: { idGradeItem: number } }[],
): Promise<void> {
  const ids = details.map((detail) => detail.gradeItem.idGradeItem);
  if (new Set(ids).size !== ids.length) {
    throw new BadRequestException('No se puede repetir un criterio en el esquema');
  }
  const items = await manager.getRepository(GradeItem).find({
    where: { idGradeItem: In(ids) },
  });
  if (items.length !== ids.length) {
    throw new BadRequestException('Ítem de calificación inexistente o inactivo');
  }
  if (items.some((item) => !isAssistantGradeItem(item))) {
    throw new BadRequestException(
      'El criterio seleccionado no está permitido en la configuración del auxiliar.',
    );
  }
}
