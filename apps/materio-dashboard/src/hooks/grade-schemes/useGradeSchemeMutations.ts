'use client';

import {
  deleteGradeScheme,
  reactivateGradeScheme,
  updateGradeScheme,
  createGradeScheme,
} from '@/api/grade-scheme.service';

import type { IGradeSchemeCreateOrEdit } from '@/interfaces/grade-schemes/grade-scheme-edit.interface';

interface Props {
  reload(): Promise<void>;
}

export function useGradeSchemeMutations(props: Props) {
  const { reload } = props;

  const create = async (dto: IGradeSchemeCreateOrEdit) => {
    const created = await createGradeScheme(dto);

    return created;
  };

  const update = async (idGradeScheme: number, dto: IGradeSchemeCreateOrEdit) => {
    await updateGradeScheme(idGradeScheme, dto);

    reload();
  };

  const remove = async (idGradeScheme: number) => {
    await deleteGradeScheme(idGradeScheme);

    reload();
  };

  const restore = async (idGradeScheme: number) => {
    await reactivateGradeScheme(idGradeScheme);

    reload();
  };

  return {
    create,
    update,
    remove,
    restore,
  };
}
