'use client';

import { useState } from 'react';

import { getGradeSchemeById } from '@/api/grade-scheme.service';

import type { IGradeSchemeCreateOrEdit } from '@/interfaces/grade-schemes/grade-scheme-edit.interface';
import { useSnackbar } from '../useSnackbar';
import { getApiErrorMessage } from '@/utils/http/getApiErrorMessage';

interface UseGradeSchemeEditorProps {
  update(id: number, dto: IGradeSchemeCreateOrEdit): Promise<void>;
}

export function useGradeSchemeEditor({ update }: UseGradeSchemeEditorProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initialValue, setInitialValue] = useState<IGradeSchemeCreateOrEdit>();
  const [editingId, setEditingId] = useState<number | null>(null);

  const snackbar = useSnackbar();

  const openEditor = async (id: number) => {
    setEditingId(id);
    setLoading(true);

    try {
      const data = await getGradeSchemeById(id);

      setInitialValue({
        name: data.name,
        description: data.description,
        details: data.details,
      });

      setOpen(true);
    } finally {
      setLoading(false);
    }
  };

  const close = () => {
    setOpen(false);
    setEditingId(null);
    setInitialValue(undefined);
  };

  const submit = async (dto: IGradeSchemeCreateOrEdit) => {
    if (!initialValue) return;

    setLoading(true);

    try {
      if (!editingId) return;

      await update(editingId, dto);

      snackbar.success('Esquema editado correctamente');

      setOpen(false);
    } catch (error) {
      snackbar.error(getApiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return {
    open,
    loading,

    editingId,
    initialValue,

    openEditor,
    close,

    submit,
  };
}
