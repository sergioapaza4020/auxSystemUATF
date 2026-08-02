import { useEffect, useState } from 'react';

import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Grid, TextField } from '@mui/material';

import Form from '@components/Form';

import type { IGradeItem } from '@/interfaces/grade-items/grade-item.interface';
import type { IGradeScheme } from '@/interfaces/grade-schemes/grade-scheme.interface';

import { GradeSchemeItemsEditor } from './GradeSchemeItemsEditor';

interface GradeSchemeEditDialogProps {
  open: boolean;
  gradeScheme?: IGradeScheme;
  gradeItems: IGradeItem[];
  loading: boolean;
  onClose: () => void;
  onSubmit: (gradeScheme: IGradeScheme) => Promise<void>;
}

export function GradeSchemeEditDialog(props: GradeSchemeEditDialogProps) {
  const { open, gradeScheme, gradeItems, loading, onClose, onSubmit } = props;

  const [form, setForm] = useState<IGradeScheme | null>(null);

  useEffect(() => {
    if (open && gradeScheme) {
      setForm(structuredClone(gradeScheme));
    }
  }, [open, gradeScheme]);

  const updateField = <K extends keyof IGradeScheme>(key: K, value: IGradeScheme[K]) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const totalPercentage = form?.details.reduce((sum, detail) => sum + detail.percentage, 0) ?? 0;

  const isFormValid = (): boolean => {
    if (!form) return false;
    if (!form.name.trim()) return false;
    if (form.details.length === 0) return false;
    if (totalPercentage !== 100) return false;

    return form.details.every((detail) => detail.percentage > 0);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form) return;

    await onSubmit(form);
  };

  if (!form) return null;

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle style={{ textAlign: 'center', textTransform: 'uppercase', fontWeight: 600 }}>
        Editar esquema de notas
      </DialogTitle>
      <DialogContent>
        <Form onSubmit={handleSubmit} id='update-grade-scheme'>
          <Grid container spacing={5}>
            <Grid item xs={12}>
              <TextField
                autoFocus
                required
                margin='dense'
                id='name'
                name='name'
                label='Nombre'
                type='text'
                fullWidth
                value={form?.name}
                onChange={(e) => updateField('name', e.target.value)}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                margin='dense'
                id='description'
                name='description'
                label='Descripción'
                type='text'
                maxRows={4}
                multiline
                fullWidth
                value={form?.description ?? ''}
                onChange={(e) => updateField('description', e.target.value)}
              />
            </Grid>
            <Grid item xs={12}>
              <GradeSchemeItemsEditor
                gradeItems={gradeItems}
                details={form.details}
                totalPercentage={totalPercentage}
                onChange={(details) => updateField('details', details)}
              />
            </Grid>
          </Grid>
        </Form>
      </DialogContent>
      <DialogActions>
        <Button variant='contained' color='error' onClick={onClose}>
          Cerrar
        </Button>
        <Button
          variant='contained'
          color='info'
          type='submit'
          form='update-grade-scheme'
          disabled={loading || !isFormValid}
        >
          Editar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
