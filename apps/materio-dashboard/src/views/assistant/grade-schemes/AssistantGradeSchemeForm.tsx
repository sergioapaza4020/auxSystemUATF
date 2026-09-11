'use client';

import { useState } from 'react';

import { Button, Card, CardContent, CardHeader, Grid, TextField } from '@mui/material';

import Form from '@components/Form';

import { useGradeItems } from '@/hooks/grade-items';

import { LoadingOverlay } from '@/components/feedback/LoadingOverlay';

import { GradeSchemeItemsEditor } from '@/views/admin/grade-schemes/components/GradeSchemeItemsEditor';

import { useAssistantGradeScheme } from '@/hooks/assistant-grade-schemes/useAssistantGradeScheme';

import { useAssistantGradeSchemeForm } from '@/hooks/assistant-grade-schemes/useAssistantGradeSchemeForm';

interface AssistantGradeSchemeFormProps {
  idCourse: number;
}

export function AssistantGradeSchemeForm({ idCourse }: AssistantGradeSchemeFormProps) {
  const [saving, setSaving] = useState(false);

  const { form, updateField, handleGradeItemChange, handlePercentageChange, totalPercentage, isValid } =
    useAssistantGradeSchemeForm();

  const { create } = useAssistantGradeScheme(idCourse);

  const { gradeItems, loading: loadingGradeItems } = useGradeItems();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isValid) {
      return;
    }

    setSaving(true);

    try {
      await create(form);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title='Configurar evaluación del auxiliar'
        subheader='Define el porcentaje que representa tu trabajo y cómo se distribuye internamente.'
      />

      <CardContent>
        <Form onSubmit={handleSubmit} id='assistant-grade-scheme-form'>
          <Grid container spacing={5}>
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
                }}
                helperText='Porcentaje que representa el auxiliar dentro de la materia.'
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
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

            <Grid item xs={12} md={9}>
              <GradeSchemeItemsEditor
                gradeItems={gradeItems}
                details={form.details}
                loading={loadingGradeItems}
                totalPercentage={totalPercentage}
                onGradeItemChange={handleGradeItemChange}
                onPercentageChange={handlePercentageChange}
              />
            </Grid>

            <Grid item xs={12}>
              <Button variant='contained' type='submit' disabled={!isValid || saving}>
                Guardar configuración
              </Button>
            </Grid>
          </Grid>
        </Form>
      </CardContent>

      <LoadingOverlay open={saving} />
    </Card>
  );
}
