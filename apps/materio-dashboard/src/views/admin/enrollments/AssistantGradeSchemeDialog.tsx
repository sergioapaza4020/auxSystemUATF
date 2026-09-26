'use client';

import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

import Form from '@components/Form';

import type { IGradeItem } from '@/interfaces/grade-items/grade-item.interface';
import type { IAssistantGradeSchemeCreate } from '@/interfaces/grade-schemes/assistant-grade-scheme.interface';

import { useAssistantGradeSchemeForm } from '@/hooks/assistant-grade-schemes/useAssistantGradeSchemeForm';

import { GradeSchemeItemsEditor } from '../grade-schemes/components/GradeSchemeItemsEditor';
import { LoadingOverlay } from '@/components/feedback/LoadingOverlay';

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

  const formId = 'assistant-grade-scheme-form';
  const isEditing = !!initialValue;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isValid) return;

    await onSubmit(form);
  };

  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : onClose}
      fullWidth
      maxWidth='md'
      PaperProps={{
        sx: {
          borderRadius: 3,
          overflow: 'hidden',
        },
      }}
    >
      <DialogTitle sx={{ px: 6, pt: 5, pb: 2 }}>
        <Stack spacing={0.5}>
          <Typography variant='h5' fontWeight={600}>
            {isEditing ? 'Editar evaluación del auxiliar' : 'Configurar evaluación del auxiliar'}
          </Typography>

          <Typography variant='body2' color='text.secondary'>
            Define el porcentaje correspondiente al auxiliar y distribuye los elementos que formarán parte de su
            evaluación.
          </Typography>
        </Stack>
      </DialogTitle>

      <DialogContent
        sx={{
          px: 6,
          pt: '16px !important',
          pb: 4,
        }}
      >
        <Form onSubmit={handleSubmit} id={formId}>
          <Grid container spacing={4}>
            <Grid item xs={12}>
              <Box
                sx={{
                  p: 4,
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 2,
                  bgcolor: 'action.hover',
                }}
              >
                <Grid container spacing={3} alignItems='center'>
                  <Grid item xs={12} sm={8}>
                    <Typography fontWeight={600}>Porcentaje del auxiliar</Typography>

                    <Typography variant='body2' color='text.secondary' sx={{ mt: 0.5 }}>
                      Indica cuánto representa la evaluación del auxiliar dentro de la calificación total de la materia.
                    </Typography>
                  </Grid>

                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      required
                      size='small'
                      type='number'
                      label='Porcentaje'
                      value={form.assistantPercentage || ''}
                      onChange={(event) => updateField('assistantPercentage', Number(event.target.value))}
                      inputProps={{
                        min: 0,
                        max: 100,
                        step: 0.01,
                      }}
                      InputProps={{
                        endAdornment: <Typography color='text.secondary'>%</Typography>,
                      }}
                    />
                  </Grid>
                </Grid>
              </Box>
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                required
                label='Nombre'
                placeholder='Ej. Evaluación del auxiliar'
                value={form.name ?? ''}
                onChange={(event) => updateField('name', event.target.value)}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                minRows={2}
                maxRows={4}
                label='Descripción'
                placeholder='Descripción de la evaluación (opcional)'
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

      <DialogActions
        sx={{
          px: 6,
          py: 4,
          borderTop: 1,
          borderColor: 'divider',
          gap: 2,
        }}
      >
        <Button variant='outlined' color='inherit' onClick={onClose} disabled={loading}>
          Cancelar
        </Button>

        <Button variant='contained' color='primary' type='submit' form={formId} disabled={loading || !isValid}>
          {isEditing ? 'Guardar cambios' : 'Guardar configuración'}
        </Button>
      </DialogActions>

      <LoadingOverlay open={loading} />
    </Dialog>
  );
}
