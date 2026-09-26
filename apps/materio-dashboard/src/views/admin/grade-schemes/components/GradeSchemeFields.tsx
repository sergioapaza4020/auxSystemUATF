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
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <TextField
          autoFocus
          required
          fullWidth
          id='name'
          name='name'
          label='Nombre'
          placeholder='Nombre del esquema'
          value={form.name}
          onChange={(event) => updateField('name', event.target.value)}
        />
      </Grid>

      <Grid item xs={12}>
        <TextField
          fullWidth
          multiline
          minRows={2}
          maxRows={4}
          id='description'
          name='description'
          label='Descripción'
          placeholder='Descripción del esquema (opcional)'
          value={form.description}
          onChange={(event) => updateField('description', event.target.value)}
          inputProps={{
            maxLength: 250,
          }}
          helperText={`${form.description?.length ?? 0}/250`}
          FormHelperTextProps={{
            sx: {
              textAlign: 'right',
              mr: 0,
            },
          }}
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
  );
}
