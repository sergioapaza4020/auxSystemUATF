'use client';

import { useEffect } from 'react';

import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Grid, TextField } from '@mui/material';

import Form from '@components/Form';

import type { IGradeItem } from '@/interfaces/grade-items/grade-item.interface';
import type { IAssistantGradeSchemeCreate } from '@/interfaces/grade-schemes/assistant-grade-scheme.interface';

import { useAssistantGradeSchemeForm } from '@/hooks/assistant-grade-schemes/useAssistantGradeSchemeForm';

import { GradeSchemeItemsEditor } from '../grade-schemes/components/GradeSchemeItemsEditor';

interface AssistantGradeSchemeDialogProps {
  open: boolean;
  loading: boolean;
  gradeItems: IGradeItem[];
  loadingGradeItems: boolean;
  initialValue?: IAssistantGradeSchemeCreate;
  onClose: () => void;
  onSubmit: (data: IAssistantGradeSchemeCreate) => Promise<void>;
}

export function AssistantGradeSchemeDialog({
  open,
  loading,
  gradeItems,
  loadingGradeItems,
  initialValue,
  onClose,
  onSubmit,
}: AssistantGradeSchemeDialogProps) {
  const { form, updateField, handleGradeItemChange, handlePercentageChange, totalPercentage, isValid } =
    useAssistantGradeSchemeForm({
      initialValue,
    });

  useEffect(() => {
    if (!open) return;
  }, [open]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isValid) return;

    await onSubmit(form);
  };

  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} fullWidth maxWidth='md'>
      <DialogTitle>
        {initialValue ? 'Editar evaluación del auxiliar' : 'Configurar evaluación del auxiliar'}
      </DialogTitle>

      <DialogContent>
        <Form onSubmit={handleSubmit} id='assistant-grade-scheme-form'>
          <Grid container spacing={4} sx={{ mt: 0 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                required
                type='number'
                label='Porcentaje del auxiliar'
                value={form.assistantPercentage || ''}
                onChange={(event) => updateField('assistantPercentage', Number(event.target.value))}
                inputProps={{
                  min: 0,
                  max: 100,
                  step: 0.01,
                }}
                helperText='Indica cuánto representa tu trabajo dentro de la materia.'
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                required
                label='Nombre'
                value={form.name ?? ''}
                onChange={(event) => updateField('name', event.target.value)}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                maxRows={4}
                label='Descripción'
                value={form.description ?? ''}
                onChange={(event) => updateField('description', event.target.value)}
              />
            </Grid>

            <Grid item xs={12}>
              <GradeSchemeItemsEditor
                gradeItems={gradeItems}
                details={form.details}
                loading={loadingGradeItems}
                totalPercentage={totalPercentage}
                onGradeItemChange={handleGradeItemChange}
                onPercentageChange={handlePercentageChange}
              />
            </Grid>
          </Grid>
        </Form>
      </DialogContent>

      <DialogActions>
        <Button color='error' variant='contained' onClick={onClose} disabled={loading}>
          Cancelar
        </Button>

        <Button
          color='primary'
          variant='contained'
          type='submit'
          form='assistant-grade-scheme-form'
          disabled={loading || !isValid}
        >
          {initialValue ? 'Guardar cambios' : 'Guardar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
