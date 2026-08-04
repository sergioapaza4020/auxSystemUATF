'use client';

import * as React from 'react';
import { useState } from 'react';

import { useRouter } from 'next/navigation';

import { Button, Card, CardContent, CardHeader } from '@mui/material';

import Form from '@components/Form';
import { useSnackbar } from '@/hooks/useSnackbar';
import { getApiErrorMessage } from '@/utils/http/getApiErrorMessage';
import { useGradeSchemeForm, useGradeSchemeMutations } from '@/hooks/grade-schemes';
import { LoadingOverlay } from '@/components/feedback/LoadingOverlay';
import { useGradeItems } from '@/hooks/grade-items';
import { GradeSchemeFields } from './components/GradeSchemeFields';

export const GradeSchemeForm = () => {
  const [creating, setCreating] = useState<boolean>(false);

  const router = useRouter();

  const snackbar = useSnackbar();

  const { gradeScheme, updateField, handleGradeItemChange, handlePercentageChange, totalPercentage, isValid, reset } =
    useGradeSchemeForm();

  const { gradeItems, load, loading: loadingGradeItems } = useGradeItems();
  const { create: createGradeScheme } = useGradeSchemeMutations({ reload: load });

  const handleCreateForm = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    setCreating(true);

    if (!gradeScheme) return;

    try {
      await createGradeScheme(gradeScheme);

      snackbar.success(
        'Esquema creado correctamente',
        <Button size='small' variant='contained' onClick={() => router.push('/dashboard/admin/grade-schemes')}>
          Ver tabla
        </Button>,
      );
    } catch (error) {
      snackbar.error(getApiErrorMessage(error));
    } finally {
      setCreating(false);
    }

    reset();
  };

  return (
    <Card>
      <CardHeader title='Registrar nuevo esquema de notas' />
      <CardContent>
        <Form onSubmit={handleCreateForm} id='create-grade-scheme'>
          <GradeSchemeFields
            form={gradeScheme}
            gradeItems={gradeItems}
            loadingGradeItems={loadingGradeItems}
            updateField={updateField}
            handleGradeItemChange={handleGradeItemChange}
            handlePercentageChange={handlePercentageChange}
            totalPercentage={totalPercentage}
          />
          <Button variant='contained' type='submit' form='create-grade-scheme' disabled={!isValid || creating}>
            Registrar
          </Button>
        </Form>
      </CardContent>

      <LoadingOverlay open={creating} />
    </Card>
  );
};
