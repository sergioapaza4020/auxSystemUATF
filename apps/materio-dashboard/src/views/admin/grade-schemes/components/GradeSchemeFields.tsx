import { Grid, TextField } from '@mui/material';

import type { IGradeItem } from '@/interfaces/grade-items/grade-item.interface';
import type { IGradeSchemeCreateOrEdit } from '@/interfaces/grade-schemes/grade-scheme-edit.interface';
import { GradeSchemeItemsEditor } from './GradeSchemeItemsEditor';

interface GradeSchemeFieldsProps {
  form: IGradeSchemeCreateOrEdit;

  gradeItems: IGradeItem[];
  loadingGradeItems: boolean;

  updateField<K extends keyof IGradeSchemeCreateOrEdit>(key: K, value: IGradeSchemeCreateOrEdit[K]): void;
  handleGradeItemChange(gradeItem: IGradeItem, checked: boolean): void;
  handlePercentageChange(idGradeItem: number, percentage: number): void;

  totalPercentage: number;
}

export function GradeSchemeFields(props: GradeSchemeFieldsProps) {
  const {
    form,
    gradeItems,
    loadingGradeItems,
    updateField,
    handleGradeItemChange,
    handlePercentageChange,
    totalPercentage,
  } = props;

  return (
    <Grid container spacing={5}>
      <Grid item xs={12}>
        <TextField
          autoFocus
          required
          fullWidth
          margin='dense'
          id='name'
          name='name'
          label='Nombre'
          placeholder='Nombre del esquema'
          type='text'
          value={form.name}
          onChange={(e) => updateField('name', e.target.value)}
        />
      </Grid>
      <Grid item xs={12}>
        <TextField
          id='description'
          name='description'
          label='Descripción'
          placeholder='Descripción (opcional)'
          type='text'
          maxRows={4}
          multiline
          fullWidth
          value={form.description}
          onChange={(e) => updateField('description', e.target.value)}
        />
      </Grid>
      <Grid item xs={9}>
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
  );
}
